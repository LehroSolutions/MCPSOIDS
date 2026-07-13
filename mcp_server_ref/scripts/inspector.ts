import http from 'http';

const MCP_HOST = process.env.MCP_HOST ?? '127.0.0.1';
const MCP_PORT = process.env.MCP_PORT ? Number(process.env.MCP_PORT) : 3000;
const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;

type RpcResponse = {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: { code: number; message: string; data?: unknown };
};

function authHeaders(includeAuth = true): Record<string, string> {
  if (!includeAuth || !MCP_AUTH_TOKEN) return {};
  return { authorization: `Bearer ${MCP_AUTH_TOKEN}` };
}

async function httpRequest(
  method: 'GET' | 'POST',
  requestPath: string,
  body?: string,
  includeAuth = true,
) {
  return new Promise<{ statusCode?: number; body: string }>((resolve, reject) => {
    const req = http.request(
      {
        hostname: MCP_HOST,
        port: MCP_PORT,
        path: requestPath,
        method,
        headers: {
          ...authHeaders(includeAuth),
          ...(body
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body).toString(),
              }
            : {}),
        },
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => (responseBody += chunk));
        res.on('end', () => resolve({ statusCode: res.statusCode, body: responseBody }));
      },
    );

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function rpcCall(method: string, params: any): Promise<RpcResponse> {
  const data = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method,
    params,
  });

  const res = await httpRequest('POST', '/mcp', data);
  return JSON.parse(res.body);
}

async function getJson(path: string) {
  const res = await httpRequest('GET', path);
  return JSON.parse(res.body);
}

async function runInspection() {
  console.log('Inspector: Connected to Reference Server');

  if (MCP_AUTH_TOKEN) {
    console.log('Verifying Auth Gate...');
    const unauth = await httpRequest('GET', '/.well-known/mcp-health', undefined, false);
    if (unauth.statusCode !== 401) {
      throw new Error(
        `Auth check failed - expected 401 without token, received ${unauth.statusCode}`,
      );
    }
    console.log('Auth Gate Verified');
  }

  console.log('Checking Health Endpoint...');
  const health: any = await getJson('/.well-known/mcp-health');
  if (health.status !== 'green') throw new Error('Health check failed');
  console.log('Health Check Passed');

  console.log('Verifying Compliance Tool (__echo)...');
  const echoRes: any = await rpcCall('tools/call', {
    name: '__echo',
    arguments: { message: 'verify_me', delay_ms: 10 },
    sessionId: 'inspector-session',
    agentId: 'inspector',
  });

  if (echoRes.result !== 'verify_me' && echoRes.result?.result !== 'verify_me') {
    console.error(echoRes);
    throw new Error('Echo check failed');
  }
  console.log('Compliance Tool Verified');

  console.log('Verifying Tools Catalog (fs/ls, fs/read_file)...');
  const listRes: any = await rpcCall('tools/list', {});
  const tools = listRes.result?.tools || [];
  const names = new Set(tools.map((t: any) => t.name));
  if (!names.has('__echo') || !names.has('fs/ls') || !names.has('fs/read_file')) {
    console.error(listRes);
    throw new Error('Tools list missing required tools');
  }
  console.log('Tool Catalog Verified');

  console.log('Verifying FileSystem Tools (fs/ls, fs/read_file)...');
  const lsRes: any = await rpcCall('tools/call', {
    name: 'fs/ls',
    arguments: { path: '.' },
    sessionId: 'inspector-session',
    agentId: 'inspector',
  });
  const entries = lsRes?.result?.entries ?? lsRes?.result?.result?.entries;
  if (!Array.isArray(entries)) {
    console.error(lsRes);
    throw new Error('fs/ls returned invalid shape');
  }

  const readRes: any = await rpcCall('tools/call', {
    name: 'fs/read_file',
    arguments: { path: 'package.json', max_bytes: 2048 },
    sessionId: 'inspector-session',
    agentId: 'inspector',
  });
  const content = readRes?.result?.content ?? readRes?.result?.result?.content;
  if (typeof content !== 'string' || !content.includes('"name"')) {
    console.error(readRes);
    throw new Error('fs/read_file failed to read package.json');
  }
  console.log('FileSystem Tools Verified');

  console.log('Verifying Roots Security (deny traversal)...');
  const rootsRes: any = await rpcCall('tools/call', {
    name: 'fs/ls',
    arguments: { path: '..' },
    sessionId: 'inspector-session',
    agentId: 'inspector',
  });
  if (rootsRes?.error?.code !== -32602) {
    console.error(rootsRes);
    throw new Error('Roots security check failed - expected -32602');
  }
  console.log('Roots Security Verified');

  console.log('Running Fuzz/Negative Test...');
  const fuzzRes: any = await rpcCall('tools/call', {
    name: 'non_existent_tool',
    sessionId: 'inspector-session',
    agentId: 'inspector',
  });
  if (fuzzRes.error?.code !== -32601) {
    throw new Error('Fuzz test failed - server did not return correct error code');
  }
  console.log('Error Handling Verified');

  console.log('Running Timeout Test...');
  const timeoutRes: any = await rpcCall('tools/call', {
    name: '__echo',
    arguments: { message: 'slow', delay_ms: 31_000 },
    sessionId: 'inspector-session',
    agentId: 'inspector',
  });
  if (timeoutRes.error?.code !== -32000) {
    console.error(timeoutRes);
    throw new Error('Timeout test failed - server did not return -32000');
  }
  console.log('Timeout Handling Verified');

  console.log('Running Concurrency/Overload Test...');
  const calls = Array.from({ length: 50 }).map(() =>
    rpcCall('tools/call', {
      name: '__echo',
      arguments: { message: 'ping' },
      sessionId: 'inspector-session',
      agentId: 'inspector',
    }),
  );
  const results: any[] = await Promise.all(calls);
  const bad = results.find((r) => r?.error && ![-32000].includes(r.error.code));
  if (bad) {
    console.error(bad);
    throw new Error('Concurrency test failed - unexpected error');
  }
  console.log('Concurrency Verified');

  console.log('Verifying Audit Log...');
  const auditRes: any = await getJson('/audit/entries?limit=20');
  const auditEntries = auditRes.entries ?? [];
  if (!Array.isArray(auditEntries) || auditEntries.length === 0) {
    console.error(auditRes);
    throw new Error('Audit log check failed - expected at least one entry');
  }
  const hasEchoAudit = auditEntries.some(
    (entry: any) =>
      entry.toolName === '__echo' && typeof entry.inputHash === 'string' && !('arguments' in entry),
  );
  if (!hasEchoAudit) {
    console.error(auditRes);
    throw new Error('Audit log check failed - expected hashed __echo entry without raw arguments');
  }

  const integrity: any = await getJson('/audit/integrity');
  if (integrity.valid !== true) {
    console.error(integrity);
    throw new Error('Audit integrity check failed');
  }
  console.log('Audit Log Verified');

  console.log('\nACTIVE ROBUSTNESS CERTIFIED');
}

runInspection().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
