import { describe, expect, test } from 'bun:test';
import { envSchema } from '../src/config';

describe('configuration boundaries', () => {
  test.each(['NaN', 'Infinity', '0', '-1', '1.5', ''])(
    'rejects invalid numeric limits: %s',
    (value) => {
      for (const field of [
        'PORT',
        'MCP_MAX_ACTIVE_REQUESTS',
        'MCP_TOOL_TIMEOUT_MS',
        'MCP_AUDIT_MAX_READ_ENTRIES',
      ]) {
        expect(envSchema.safeParse({ [field]: value }).success).toBe(false);
      }
    },
  );

  test('requires a strong auth token in production', () => {
    expect(envSchema.safeParse({ NODE_ENV: 'production' }).success).toBe(false);
    expect(
      envSchema.safeParse({ NODE_ENV: 'production', MCP_AUTH_TOKEN: 'replace-me' }).success,
    ).toBe(false);
    expect(
      envSchema.safeParse({
        NODE_ENV: 'production',
        MCP_AUTH_TOKEN: 'test-only-token-with-at-least-32-characters',
      }).success,
    ).toBe(true);
  });

  test('rejects limits outside supported resource budgets', () => {
    expect(envSchema.safeParse({ PORT: '65536' }).success).toBe(false);
    expect(envSchema.safeParse({ MCP_TOOL_TIMEOUT_MS: '300001' }).success).toBe(false);
    expect(envSchema.safeParse({ MCP_AUDIT_MAX_READ_ENTRIES: '10001' }).success).toBe(false);
  });
});
