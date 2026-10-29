import 'dotenv/config';
import path from 'path';
import { HttpTransport } from './transport/http';
import { HealthMonitor } from './features/health';
import { SecurityManager } from './features/security';
import { config, resolveDebugToolsEnabled } from './config';

export type McpServerOptions = {
  host?: string;
  port?: number;
  roots?: string[];
  enableFsTools?: boolean;
  cors?: {
    allowAll?: boolean;
    origins?: string[];
  };
  maxActiveRequests?: number;
  toolTimeoutMs?: number;
  janitorExitOnRed?: boolean;
  janitorIntervalMs?: number;
};

export function startMcpServer(options: McpServerOptions) {
  const host = options.host ?? config.HOST;
  const port = options.port ?? config.PORT;
  if (!['127.0.0.1', '::1', 'localhost'].includes(host) && !config.MCP_AUTH_TOKEN?.trim()) {
    throw new Error('MCP_AUTH_TOKEN is required when binding outside loopback');
  }
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('Port must be an integer between 0 and 65535');
  }
  const healthMonitor = new HealthMonitor();

  const envRoots = config.MCP_ROOTS ? config.MCP_ROOTS.split(path.delimiter).filter(Boolean) : [];
  const enableFsTools = options.enableFsTools ?? (config.MCP_ENABLE_FS || envRoots.length > 0);
  const providedRoots = options.roots ?? envRoots;
  const roots = enableFsTools && providedRoots.length === 0 ? [process.cwd()] : providedRoots;
  const securityManager = new SecurityManager(roots);

  const transport = new HttpTransport(healthMonitor, securityManager, {
    enableFsTools,
    enableDebugTools: resolveDebugToolsEnabled(config),
    cors:
      options.cors ??
      (config.MCP_ALLOWED_ORIGIN ? { origins: [config.MCP_ALLOWED_ORIGIN] } : undefined),
    maxActiveRequests: options.maxActiveRequests ?? config.MCP_MAX_ACTIVE_REQUESTS,
    toolTimeoutMs: options.toolTimeoutMs ?? config.MCP_TOOL_TIMEOUT_MS,
  });

  const server = transport.start(port, host);

  if (options.janitorExitOnRed) {
    const intervalMs = options.janitorIntervalMs ?? 5000;
    setInterval(() => {
      const status = healthMonitor.getStatus();
      if (status.status === 'red') {
        console.error(' [JANITOR] CRITICAL HEALTH DETECTED. Terminating process...');
        process.exit(1);
      }
    }, intervalMs);
  }

  return { server, healthMonitor };
}
