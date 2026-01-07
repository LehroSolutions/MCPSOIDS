import http from 'http';

type RpcResponse = {
    jsonrpc: '2.0';
    id: string | number | null;
    result?: any;
    error?: { code: number; message: string; data?: unknown };
};

function getServerBaseUrl(): URL {
    const raw = process.env.MCP_SERVER_URL ?? 'http://localhost:3000';
    return new URL(raw);
}

function getAuthHeader(): string | undefined {
    const token = process.env.MCP_AUTH_TOKEN;
    if (!token) return undefined;
    return `Bearer ${token}`;
}

async function httpRequest(method: 'GET' | 'POST', path: string, body?: string) {
    const baseUrl = getServerBaseUrl();
    const auth = getAuthHeader();

    return new Promise<{ statusCode?: number; headers: http.IncomingHttpHeaders; body: string }>((resolve, reject) => {
        const req = http.request(
            {
                protocol: baseUrl.protocol,
                hostname: baseUrl.hostname,
                port: baseUrl.port || (baseUrl.protocol === 'https:' ? 443 : 80),
                path,
                method,
                headers: {
                    ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
                    ...(typeof body === 'string' ? { 'Content-Length': Buffer.byteLength(body) } : {}),
                    ...(auth ? { authorization: auth } : {}),
                },
            },
            (res) => {
                let responseBody = '';
                res.on('data', (chunk) => (responseBody += chunk));
                res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: responseBody }));
            }
        );

        req.on('error', reject);
        if (typeof body === 'string') req.write(body);
        req.end();
    });
}

async function rpcCall(method: string, params: any): Promise<RpcResponse> {
    const data = JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
    });

    const res = await httpRequest('POST', '/mcp', data);
    const contentType = String(res.headers['content-type'] ?? '');

    try {
        return JSON.parse(res.body);
    } catch {
        const preview = res.body.slice(0, 200).replace(/\s+/g, ' ');
        throw new Error(
            [
                `RPC call did not return JSON (status=${res.statusCode}, content-type=${contentType}).`,
                `First 200 chars: ${preview}`,
                `Likely cause: something else is running on ${getServerBaseUrl().origin} (e.g., Next.js dev server).`,
                `Fix: set MCP_SERVER_URL to the MCP server, e.g.`,
                `  PowerShell: $env:MCP_SERVER_URL = "http://localhost:3000"`,
                `  Or run MCP server on another port (e.g. --port 3002) and set MCP_SERVER_URL accordingly.`,
            ].join('\n')
        );
    }
}

async function checkHealth() {
    const res = await httpRequest('GET', '/.well-known/mcp-health');
    try {
        return JSON.parse(res.body);
    } catch {
        const preview = res.body.slice(0, 200).replace(/\s+/g, ' ');
        throw new Error(
            [
                `Health endpoint did not return JSON (status=${res.statusCode}).`,
                `First 200 chars: ${preview}`,
                `This usually means you're not hitting the MCP server on ${getServerBaseUrl().origin}.`,
            ].join('\n')
        );
    }
}

async function runStressTest() {
    console.log(`🔥 Stress Test: Starting (server=${getServerBaseUrl().origin})...\n`);

    console.log('Preflight: Health Check...');
    const health: any = await checkHealth();
    if (!health?.status || !health?.metrics) {
        console.log('Health response:', health);
        throw new Error('Unexpected health payload (not an MCP reference server?)');
    }
    console.log(`✅ Health OK (status=${health.status})\n`);

    // 1. Memory stress - should trigger Yellow/Red health status
    console.log("1️⃣  Memory Stress Test (allocating 100MB for 10 seconds)");
    console.log("   👉 Watch the Dashboard - Memory should spike to 100MB+");
    console.log("   👉 Health status should go Yellow → Red");
    
    const memResult: any = await rpcCall('tools/call', {
        name: '__debug_stress',
        arguments: { mode: 'memory', duration_ms: 10000, intensity: 100 }
    });
    if (memResult?.error?.code === -32601) {
        throw new Error(
            [
                'Server responded: Tool not found (__debug_stress).',
                'Enable debug tools and restart the server:',
                '  PowerShell: $env:MCP_ENABLE_DEBUG_TOOLS = "true"',
                '  Then restart `npm start` in mcp_server_ref.',
            ].join('\n')
        );
    }
    console.log("   ✅", memResult.result ?? memResult);

    console.log("\n2️⃣  Waiting 3 seconds for health to recover...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    // 2. Concurrency stress
    console.log("\n3️⃣  Concurrency Test (50 parallel requests)");
    console.log("   👉 Active Requests counter should spike");
    
    const concurrentCalls = Array.from({ length: 50 }).map(() =>
        rpcCall('tools/call', {
            name: '__echo',
            arguments: { message: 'concurrent', delay_ms: 100 }
        })
    );

    const results = await Promise.all(concurrentCalls);
    const successful = results.filter((r: any) => r.result && !r.error).length;
    console.log(`   ✅ ${successful}/50 requests succeeded`);

    console.log("\n✨ Stress Test Complete!");
    console.log("💡 Check the Dashboard - metrics should have fluctuated during the test");
}

runStressTest().catch(e => {
    console.error("FAILED:", e);
    process.exit(1);
});
