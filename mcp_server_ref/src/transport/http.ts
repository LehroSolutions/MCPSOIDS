import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { logger } from '../logger';
import { config } from '../config';
import {
    JsonRpcRequestSchema,
    createSuccessResponse,
    createErrorResponse,
    JsonRpcErrorCode
} from '../protocol/jsonrpc';
import { HealthMonitor } from '../features/health';
import { SecurityManager } from '../features/security';
import { handleEcho, ECHO_TOOL_DEFINITION } from '../tools/echo';
import { handleLs, handleReadFile, LS_TOOL_DEFINITION, READ_FILE_TOOL_DEFINITION } from '../tools/filesystem';
import { handleDebugStress, DEBUG_STRESS_TOOL_DEFINITION } from '../tools/debug';

const DEFAULT_TOOL_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_ACTIVE_REQUESTS = 50;

export type HttpTransportOptions = {
    enableFsTools?: boolean;
    enableDebugTools?: boolean;
    cors?: {
        allowAll?: boolean;
        origins?: string[];
    };
    toolTimeoutMs?: number;
    maxActiveRequests?: number;
};

export class HttpTransport {
    private app = express();
    private logger = logger;
    private healthMonitor: HealthMonitor;
    private securityManager: SecurityManager;
    private enableFsTools: boolean;
    private enableDebugTools: boolean;
    private toolTimeoutMs: number;
    private maxActiveRequests: number;

    constructor(healthMonitor: HealthMonitor, securityManager: SecurityManager, options: HttpTransportOptions = {}) {
        this.healthMonitor = healthMonitor;
        this.securityManager = securityManager;

        this.enableFsTools = options.enableFsTools ?? false;
        this.enableDebugTools = options.enableDebugTools ?? false;
        this.toolTimeoutMs = options.toolTimeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS;
        this.maxActiveRequests = options.maxActiveRequests ?? DEFAULT_MAX_ACTIVE_REQUESTS;

        if (options.cors?.allowAll) {
            this.app.use(cors());
        } else if (Array.isArray(options.cors?.origins) && options.cors!.origins!.length > 0) {
            this.app.use(cors({ origin: options.cors!.origins! }));
        }

        // Body limit from env or default
        const limit = config.MCP_JSON_BODY_LIMIT;
        this.app.use(express.json({ limit }));

        // Structured access log
        this.app.use((req, res, next) => {
            const start = Date.now();
            res.on('finish', () => {
                const duration_ms = Date.now() - start;
                this.logger.info({
                    event: 'http_request',
                    method: req.method,
                    path: req.path,
                    status: res.statusCode,
                    duration_ms,
                });
            });
            next();
        });

        // Rate Limiting
        const limiter = rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 1000, // Limit each IP to 1000 requests per windowMs
            standardHeaders: true,
            legacyHeaders: false,
        });
        this.app.use('/mcp', limiter);

        // Optional token auth
        const authToken = config.MCP_AUTH_TOKEN;
        if (authToken) {
            this.app.use((req, res, next) => {
                const auth = req.header('authorization');
                if (!auth || auth !== `Bearer ${authToken}`) {
                    res.status(401).json(createErrorResponse(null, JsonRpcErrorCode.InvalidRequest, 'Unauthorized'));
                    return;
                }
                next();
            });
        }

        // JSON body parse errors -> JSON-RPC ParseError
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        this.app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
            if (err instanceof SyntaxError) {
                res.json(createErrorResponse(null, JsonRpcErrorCode.ParseError, 'Parse error'));
                return;
            }
            if (err?.type === 'entity.too.large' || err?.status === 413) {
                res.status(413).json(createErrorResponse(null, JsonRpcErrorCode.InvalidRequest, 'Request too large'));
                return;
            }
            next(err);
        });

        // Routes
        this.app.post('/mcp', this.handleMcpRequest);
        this.app.get('/.well-known/mcp-health', this.healthMonitor.handleRequest);
        this.app.get('/metrics', this.healthMonitor.handleMetricsRequest);

        // Discovery
        this.app.get('/.well-known/mcp-configuration', (_req, res) => {
            const tools: Record<string, unknown> = {
                "__echo": ECHO_TOOL_DEFINITION,
            };

            if (this.enableFsTools) {
                tools["fs/ls"] = LS_TOOL_DEFINITION;
                tools["fs/read_file"] = READ_FILE_TOOL_DEFINITION;
            }

            if (this.enableDebugTools) {
                tools["__debug_stress"] = DEBUG_STRESS_TOOL_DEFINITION;
            }

            res.json({
                capabilities: {
                    tools: {
                        ...tools
                    }
                }
            });
        });
    }

    private handleMcpRequest = async (req: express.Request, res: express.Response) => {
        this.healthMonitor.trackRequestStart();

        if (this.healthMonitor.getActiveRequests() > this.maxActiveRequests) {
            this.healthMonitor.trackRequestEnd();
            res.status(429).json(createErrorResponse(null, JsonRpcErrorCode.Timeout, 'Too Many Requests'));
            return;
        }

        try {
            const body = req.body;
            const parseResult = JsonRpcRequestSchema.safeParse(body);

            if (!parseResult.success) {
                res.json(createErrorResponse(null, JsonRpcErrorCode.InvalidRequest, 'Invalid JSON-RPC request'));
                return;
            }

            const rpcReq = parseResult.data;

            // Dispatcher Logic
            let result;
            try {
                switch (rpcReq.method) {
                    case 'tools/call':
                        result = await this.dispatchToolCall(rpcReq.params);
                        break;
                    case 'tools/list':
                        result = {
                            tools: [
                                ECHO_TOOL_DEFINITION,
                                ...(this.enableFsTools ? [LS_TOOL_DEFINITION, READ_FILE_TOOL_DEFINITION] : []),
                                ...(this.enableDebugTools ? [DEBUG_STRESS_TOOL_DEFINITION] : []),
                            ]
                        };
                        break;
                    default:
                        throw { code: JsonRpcErrorCode.MethodNotFound, message: `Method ${rpcReq.method} not found` };
                }

                res.json(createSuccessResponse(rpcReq.id ?? null, result));

            } catch (err: any) {
                this.healthMonitor.trackError();
                const code = typeof err?.code === 'number' ? err.code : JsonRpcErrorCode.InternalError;
                const msg = typeof err?.message === 'string' ? err.message : "Internal Server Error";
                res.json(createErrorResponse(rpcReq.id ?? null, code, msg));
            }

        } catch (error) {
            this.healthMonitor.trackError();
            res.json(createErrorResponse(null, JsonRpcErrorCode.InternalError, 'Internal Server Error'));
        } finally {
            this.healthMonitor.trackRequestEnd();
        }
    };

    private async dispatchToolCall(params: any) {
        const toolName = params?.name;
        const toolArgs = params?.arguments;

        if (typeof toolName !== 'string' || toolName.length === 0) {
            throw { code: JsonRpcErrorCode.InvalidParams, message: 'Invalid params: tools/call requires a tool name' };
        }

        const timeoutMs = this.toolTimeoutMs;
        const withTimeout = async <T>(p: Promise<T>) => {
            let handle: NodeJS.Timeout | undefined;
            try {
                return await Promise.race([
                    p,
                    new Promise<T>((_resolve, reject) => {
                        handle = setTimeout(() => {
                            reject({ code: JsonRpcErrorCode.Timeout, message: 'Timeout' });
                        }, timeoutMs);
                    })
                ]);
            } finally {
                if (handle) clearTimeout(handle);
            }
        };

        try {
            switch (toolName) {
                case '__echo':
                    return await withTimeout(handleEcho(toolArgs));
                case 'fs/ls':
                    if (!this.enableFsTools) {
                        throw { code: JsonRpcErrorCode.MethodNotFound, message: 'Tool not found' };
                    }
                    return await withTimeout(handleLs(toolArgs, this.securityManager));
                case 'fs/read_file':
                    if (!this.enableFsTools) {
                        throw { code: JsonRpcErrorCode.MethodNotFound, message: 'Tool not found' };
                    }
                    return await withTimeout(handleReadFile(toolArgs, this.securityManager));
                case '__debug_stress':
                    if (!this.enableDebugTools) {
                        throw { code: JsonRpcErrorCode.MethodNotFound, message: 'Tool not found' };
                    }
                    return await withTimeout(handleDebugStress(toolArgs));
                default:
                    throw { code: JsonRpcErrorCode.MethodNotFound, message: 'Tool not found' };
            }
        } catch (err: any) {
            // Zod validation, security violations, etc. should be InvalidParams.
            if (err?.name === 'ZodError' || typeof err?.message === 'string' && err.message.startsWith('Security Violation')) {
                throw { code: JsonRpcErrorCode.InvalidParams, message: err.message };
            }
            if (typeof err?.code === 'string' && ['ENOENT', 'ENOTDIR', 'EISDIR', 'EACCES', 'EPERM'].includes(err.code)) {
                throw { code: JsonRpcErrorCode.InvalidParams, message: err.message };
            }
            throw err;
        }
    }

    public start(port: number, host?: string) {
        const onListen = () => {
            this.logger.info(`MCP Server compliant with 'Active Robustness' listening on ${host ? host + ':' : 'port '}${port}`);
        };

        if (host) {
            return this.app.listen(port, host, onListen);
        }
        return this.app.listen(port, onListen);
    }
}
