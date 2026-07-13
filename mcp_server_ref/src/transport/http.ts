import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs/promises';
import { timingSafeEqual } from 'crypto';
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
import {
    AuditLog,
    AuditOutcome,
    detectSensitiveFlags,
    getPayloadSizeBytes,
    hashPayload
} from '../governance/auditLog';
import { PolicyDecision, PolicyEngine, splitPolicyPatterns } from '../governance/policyEngine';

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
    private auditLog: AuditLog;
    private policyEngine: PolicyEngine;

    constructor(healthMonitor: HealthMonitor, securityManager: SecurityManager, options: HttpTransportOptions = {}) {
        this.healthMonitor = healthMonitor;
        this.securityManager = securityManager;

        this.enableFsTools = options.enableFsTools ?? false;
        this.enableDebugTools = options.enableDebugTools ?? false;
        this.toolTimeoutMs = options.toolTimeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS;
        this.maxActiveRequests = options.maxActiveRequests ?? DEFAULT_MAX_ACTIVE_REQUESTS;
        this.auditLog = new AuditLog(
            config.MCP_AUDIT_LOG_PATH
                ? path.resolve(config.MCP_AUDIT_LOG_PATH)
                : path.join(process.cwd(), 'data', 'audit', 'audit-log.jsonl')
        );
        this.policyEngine = new PolicyEngine({
            mode: config.MCP_POLICY_MODE,
            allowTools: splitPolicyPatterns(config.MCP_POLICY_ALLOW_TOOLS),
            denyTools: splitPolicyPatterns(config.MCP_POLICY_DENY_TOOLS),
        });

        if (options.cors?.allowAll) {
            if (config.NODE_ENV === 'production') throw new Error('Wildcard CORS is forbidden in production');
            this.app.use(cors());
        } else if (Array.isArray(options.cors?.origins) && options.cors!.origins!.length > 0) {
            this.app.use(cors({ origin: options.cors!.origins! }));
        }

        // Body limit from env or default
        const limit = config.MCP_JSON_BODY_LIMIT;
        this.app.use(express.json({ limit }));

        this.app.use((_req, res, next) => {
            res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('X-Frame-Options', 'DENY');
            res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
            res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'"); next();
        });

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
            windowMs: 15 * 60 * 1000,
            max: 1000,
            standardHeaders: true,
            legacyHeaders: false,
        });
        this.app.use('/mcp', limiter);

        this.app.get('/', async (_req, res) => {
            try { res.type('html').send(await fs.readFile(path.join(process.cwd(), 'public', 'index.html'), 'utf8')); }
            catch { res.status(404).send('Control Center asset not found.'); }
        });

        // Optional token auth
        const authToken = config.MCP_AUTH_TOKEN;
        if (authToken) {
            this.app.use((req, res, next) => {
                const auth = req.header('authorization');
                const expected = Buffer.from(`Bearer ${authToken}`); const provided = Buffer.from(auth ?? '');
                if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
                    res.status(401).json(createErrorResponse(null, JsonRpcErrorCode.InvalidRequest, 'Unauthorized'));
                    return;
                }
                next();
            });
        }

        // JSON body parse errors
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
        this.app.get('/audit/entries', this.handleAuditEntries);
        this.app.get('/audit/integrity', this.handleAuditIntegrity);

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
                        result = await this.dispatchToolCall(rpcReq.params, rpcReq.id ?? null);
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
                res.json(createErrorResponse(rpcReq.id ?? null, code, msg, err?.data));
            }

        } catch (error) {
            this.healthMonitor.trackError();
            res.json(createErrorResponse(null, JsonRpcErrorCode.InternalError, 'Internal Server Error'));
        } finally {
            this.healthMonitor.trackRequestEnd();
        }
    };

    private handleAuditEntries = async (req: express.Request, res: express.Response) => {
        try {
            const requestedLimit = Number(req.query.limit ?? config.MCP_AUDIT_MAX_READ_ENTRIES);
            const limit = Number.isFinite(requestedLimit)
                ? Math.max(1, Math.min(requestedLimit, config.MCP_AUDIT_MAX_READ_ENTRIES))
                : config.MCP_AUDIT_MAX_READ_ENTRIES;

            const entries = await this.auditLog.readRecent(limit);
            res.json({
                entries,
                limit,
                storage: 'jsonl',
            });
        } catch (err) {
            this.logger.error({ err }, 'Failed to read audit entries');
            res.status(500).json(createErrorResponse(null, JsonRpcErrorCode.InternalError, 'Failed to read audit entries'));
        }
    };

    private handleAuditIntegrity = async (_req: express.Request, res: express.Response) => {
        try {
            const integrity = await this.auditLog.verifyIntegrity();
            res.status(integrity.valid ? 200 : 409).json(integrity);
        } catch (err) {
            this.logger.error({ err }, 'Failed to verify audit integrity');
            res.status(500).json(createErrorResponse(null, JsonRpcErrorCode.InternalError, 'Failed to verify audit integrity'));
        }
    };

    private async dispatchToolCall(params: any, requestId: string | number | null) {
        const toolName = params?.name;
        const toolArgs = params?.arguments;
        const sessionId = typeof params?.sessionId === 'string' && params.sessionId.trim()
            ? params.sessionId.trim()
            : 'local-session';
        const agentId = typeof params?.agentId === 'string' && params.agentId.trim()
            ? params.agentId.trim()
            : 'control-center';
        const startedAt = Date.now();

        if (typeof toolName !== 'string' || toolName.length === 0) {
            throw { code: JsonRpcErrorCode.InvalidParams, message: 'Invalid params: tools/call requires a tool name' };
        }

        const policy = this.policyEngine.evaluate({
            action: 'tools/call',
            agentId,
            toolName,
        });

        if (!policy.allowed) {
            await this.recordToolAudit({
                requestId,
                sessionId,
                agentId,
                toolName,
                toolArgs,
                outcome: 'denied',
                policy,
                latencyMs: Date.now() - startedAt,
                errorCode: JsonRpcErrorCode.PolicyDenied,
                errorMessage: policy.reason,
            });

            throw {
                code: JsonRpcErrorCode.PolicyDenied,
                message: policy.reason,
                data: { policy },
            };
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
            let result;
            switch (toolName) {
                case '__echo':
                    result = await withTimeout(handleEcho(toolArgs));
                    break;
                case 'fs/ls':
                    if (!this.enableFsTools) {
                        throw { code: JsonRpcErrorCode.MethodNotFound, message: 'Tool not found' };
                    }
                    result = await withTimeout(handleLs(toolArgs, this.securityManager));
                    break;
                case 'fs/read_file':
                    if (!this.enableFsTools) {
                        throw { code: JsonRpcErrorCode.MethodNotFound, message: 'Tool not found' };
                    }
                    result = await withTimeout(handleReadFile(toolArgs, this.securityManager));
                    break;
                case '__debug_stress':
                    if (!this.enableDebugTools) {
                        throw { code: JsonRpcErrorCode.MethodNotFound, message: 'Tool not found' };
                    }
                    result = await withTimeout(handleDebugStress(toolArgs));
                    break;
                default:
                    throw { code: JsonRpcErrorCode.MethodNotFound, message: 'Tool not found' };
            }

            await this.recordToolAudit({
                requestId,
                sessionId,
                agentId,
                toolName,
                toolArgs,
                outcome: 'allowed',
                policy,
                latencyMs: Date.now() - startedAt,
                result,
            });

            return result;
        } catch (err: any) {
            const normalized = this.normalizeToolError(err);
            await this.recordToolAudit({
                requestId,
                sessionId,
                agentId,
                toolName,
                toolArgs,
                outcome: 'error',
                policy,
                latencyMs: Date.now() - startedAt,
                errorCode: normalized.code,
                errorMessage: normalized.message,
            });

            throw normalized;
        }
    }

    private normalizeToolError(err: any) {
            // Zod validation, security violations, etc. should be InvalidParams.
            if (err?.name === 'ZodError' || typeof err?.message === 'string' && err.message.startsWith('Security Violation')) {
                return { code: JsonRpcErrorCode.InvalidParams, message: err.message };
            }
            if (typeof err?.code === 'string' && ['ENOENT', 'ENOTDIR', 'EISDIR', 'EACCES', 'EPERM'].includes(err.code)) {
                return { code: JsonRpcErrorCode.InvalidParams, message: err.message };
            }
            return err;
    }

    private async recordToolAudit(input: {
        requestId: string | number | null;
        sessionId: string;
        agentId: string;
        toolName: string;
        toolArgs: unknown;
        outcome: AuditOutcome;
        policy: PolicyDecision;
        latencyMs: number;
        result?: unknown;
        errorCode?: number;
        errorMessage?: string;
    }) {
        try {
            await this.auditLog.append({
                requestId: input.requestId,
                sessionId: input.sessionId,
                agentId: input.agentId,
                action: 'tools/call',
                toolName: input.toolName,
                outcome: input.outcome,
                policy: input.policy,
                latencyMs: input.latencyMs,
                inputHash: hashPayload(input.toolArgs ?? {}),
                inputSensitiveFlags: detectSensitiveFlags(input.toolArgs ?? {}),
                outputHash: input.result === undefined ? undefined : hashPayload(input.result),
                outputSizeBytes: input.result === undefined ? 0 : getPayloadSizeBytes(input.result),
                outputSensitiveFlags: input.result === undefined ? [] : detectSensitiveFlags(input.result),
                errorCode: input.errorCode,
                errorHash: input.errorMessage ? hashPayload(input.errorMessage) : undefined,
            });
        } catch (err) {
            this.logger.error({ err, auditPath: this.auditLog.getPath() }, 'Failed to append audit entry');
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
