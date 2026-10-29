import { z } from 'zod';
import 'dotenv/config';

const boundedInteger = (fallback: string, maximum: number) =>
  z.string().default(fallback).transform(Number).pipe(z.number().int().min(1).max(maximum));

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: boundedInteger('3000', 65535),
    HOST: z.string().default('127.0.0.1'),
    MCP_ROOTS: z.string().optional(),
    MCP_ENABLE_FS: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    MCP_ALLOWED_ORIGIN: z.string().optional(),
    MCP_MAX_ACTIVE_REQUESTS: boundedInteger('50', 10000),
    MCP_TOOL_TIMEOUT_MS: boundedInteger('30000', 300000),
    MCP_AUTH_TOKEN: z.string().optional(),
    MCP_JSON_BODY_LIMIT: z.string().default('2mb'),
    MCP_ENABLE_DEBUG_TOOLS: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    MCP_POLICY_MODE: z.enum(['enforce', 'dry-run']).default('enforce'),
    MCP_POLICY_ALLOW_TOOLS: z.string().optional(),
    MCP_POLICY_DENY_TOOLS: z.string().optional(),
    MCP_AUDIT_LOG_PATH: z.string().optional(),
    MCP_AUDIT_MAX_READ_ENTRIES: boundedInteger('200', 10000),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === 'production' && (value.MCP_AUTH_TOKEN?.trim().length ?? 0) < 32) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['MCP_AUTH_TOKEN'],
        message: 'Production requires an MCP_AUTH_TOKEN of at least 32 characters',
      });
    }
  });

export const config = envSchema.parse(process.env);

export type DebugToolsConfigInput = {
  MCP_ENABLE_DEBUG_TOOLS?: boolean | string;
  NODE_ENV?: string;
};

// Debug tooling is an unauthenticated DoS surface, so it may only be switched on by
// an explicit MCP_ENABLE_DEBUG_TOOLS=true. NODE_ENV is accepted so a whole config
// object can be handed in, but it deliberately never enables debug tools: the
// shipped scripts leave NODE_ENV unset, which previously made them default-on.
export function resolveDebugToolsEnabled(source: DebugToolsConfigInput): boolean {
  const flag = source.MCP_ENABLE_DEBUG_TOOLS;
  return flag === true || flag === 'true';
}
