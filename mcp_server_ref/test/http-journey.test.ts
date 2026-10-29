import { afterAll, beforeAll, expect, test } from 'bun:test';
import { once } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { Server } from 'http';
import { config } from '../src/config';
import { HttpTransport } from '../src/transport/http';
import { HealthMonitor } from '../src/features/health';
import { SecurityManager } from '../src/features/security';

let server: Server;
let baseUrl = '';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-http-journey-'));
const savedToken = config.MCP_AUTH_TOKEN;
const savedAuditPath = config.MCP_AUDIT_LOG_PATH;
const savedBodyLimit = config.MCP_JSON_BODY_LIMIT;
const token = 'integration-test-token-only';

beforeAll(async () => {
  config.MCP_AUTH_TOKEN = token;
  config.MCP_AUDIT_LOG_PATH = path.join(root, 'audit.jsonl');
  config.MCP_JSON_BODY_LIMIT = '1kb';
  const transport = new HttpTransport(new HealthMonitor(), new SecurityManager([root]), {
    enableFsTools: true,
  });
  server = transport.start(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test listener');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  config.MCP_AUTH_TOKEN = savedToken;
  config.MCP_AUDIT_LOG_PATH = savedAuditPath;
  config.MCP_JSON_BODY_LIMIT = savedBodyLimit;
  fs.rmSync(root, { recursive: true, force: true });
});

async function rpc(method: string, params: unknown = {}, id: number | undefined = 1) {
  return fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, ...(id === undefined ? {} : { id }) }),
  });
}

test('requires authentication for RPC and audit data', async () => {
  expect(
    (
      await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
    ).status,
  ).toBe(401);
  expect((await fetch(`${baseUrl}/audit/entries`)).status).toBe(401);
});

test('authenticates before parsing malformed JSON and returns a bounded parse error', async () => {
  const malformed = '{ private input';
  const unauthorized = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: malformed,
  });
  expect(unauthorized.status).toBe(401);
  const response = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: malformed,
  });
  expect(response.status).toBe(400);
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(await response.json()).toEqual({
    jsonrpc: '2.0',
    id: null,
    error: { code: -32700, message: 'Parse error' },
  });
});

test('rejects oversized JSON and remains available for a subsequent request', async () => {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 2,
      method: 'ping',
      params: { text: 'x'.repeat(2048) },
    }),
  });
  expect(response.status).toBe(413);
  expect((await response.json()).error.message).toBe('Request too large');
  expect((await (await rpc('ping')).json()).result).toEqual({});
});

test('initializes an MCP client, pings, and lists callable tools', async () => {
  const initialized = await (
    await rpc('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'test', version: '1' },
    })
  ).json();
  expect(initialized.result.protocolVersion).toBe('2025-03-26');
  expect(initialized.result.capabilities.tools).toEqual({});
  expect((await (await rpc('ping')).json()).result).toEqual({});
  const listed = await (await rpc('tools/list')).json();
  expect(listed.result.tools.map((tool: { name: string }) => tool.name)).toContain('__echo');
});

test('acknowledges notifications without a JSON-RPC response', async () => {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
  });
  expect(response.status).toBe(202);
  expect(await response.text()).toBe('');
});

test('executes echo, rejects filesystem escape, and persists a valid audit chain', async () => {
  const echo = await (
    await rpc('tools/call', { name: '__echo', arguments: { message: 'hello runtime' } })
  ).json();
  expect(JSON.stringify(echo.result)).toContain('hello runtime');
  expect(echo.result.content).toEqual([{ type: 'text', text: 'hello runtime' }]);
  const escape = await (
    await rpc('tools/call', {
      name: 'fs/read_file',
      arguments: { path: path.join(root, '..', 'outside.txt') },
    })
  ).json();
  expect(escape.error.code).toBe(-32602);
  const audit = await (
    await fetch(`${baseUrl}/audit/entries`, { headers: { authorization: `Bearer ${token}` } })
  ).json();
  expect(audit.entries.length).toBe(2);
  const integrity = await (
    await fetch(`${baseUrl}/audit/integrity`, { headers: { authorization: `Bearer ${token}` } })
  ).json();
  expect(integrity.valid).toBe(true);
});

test('rejects malformed initialization and unknown methods', async () => {
  expect((await (await rpc('initialize')).json()).error.code).toBe(-32602);
  expect((await (await rpc('unsupported')).json()).error.code).toBe(-32601);
});
