import { z } from 'zod';
import 'dotenv/config';

const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.string().transform(Number).default('3000'),
    HOST: z.string().default('127.0.0.1'),
    MCP_ROOTS: z.string().optional(),
    MCP_ENABLE_FS: z.enum(['true', 'false']).transform(v => v === 'true').default('false'),
    MCP_ALLOWED_ORIGIN: z.string().optional(),
    MCP_MAX_ACTIVE_REQUESTS: z.string().transform(Number).default('50'),
    MCP_TOOL_TIMEOUT_MS: z.string().transform(Number).default('30000'),
    MCP_AUTH_TOKEN: z.string().optional(),
    MCP_JSON_BODY_LIMIT: z.string().default('2mb'),
    MCP_ENABLE_DEBUG_TOOLS: z.enum(['true', 'false']).transform(v => v === 'true').default('false'),
    MCP_POLICY_MODE: z.enum(['enforce', 'dry-run']).default('enforce'),
    MCP_POLICY_ALLOW_TOOLS: z.string().optional(),
    MCP_POLICY_DENY_TOOLS: z.string().optional(),
    MCP_AUDIT_LOG_PATH: z.string().optional(),
    MCP_AUDIT_MAX_READ_ENTRIES: z.string().transform(Number).default('200'),
});

export const config = envSchema.parse(process.env);
