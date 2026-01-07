
import http from 'http';

const MCP_HOST = process.env.MCP_HOST ?? '127.0.0.1';
const MCP_PORT = process.env.MCP_PORT ? Number(process.env.MCP_PORT) : 3000;

// Zero-dependency Inspector Client
async function rpcCall(method: string, params: any) {
    const data = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params
    });

    return new Promise((resolve, reject) => {
        const req = http.request({
            hostname: MCP_HOST,
            port: MCP_PORT,
            path: '/mcp',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function checkHealth() {
    return new Promise((resolve, reject) => {
        http.get(`http://${MCP_HOST}:${MCP_PORT}/.well-known/mcp-health`, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
    });
}

async function runInspection() {
    console.log("🕵️  Inspector: Connected to Reference Server");

    // 1. Health Check
    console.log("Checking Health Endpoint...");
    const health: any = await checkHealth();
    if (health.status !== 'green') throw new Error("Health check failed");
    console.log("✅ Health Check Passed");

    // 2. Compliance Tool Check (__echo)
    console.log("Verifying Compliance Tool (__echo)...");
    const echoRes: any = await rpcCall('tools/call', {
        name: '__echo',
        arguments: { message: "verify_me", delay_ms: 10 }
    });

    if (echoRes.result !== "verify_me" && echoRes.result?.result !== "verify_me") {
        console.error(echoRes);
        throw new Error("Echo check failed");
    }
    console.log("✅ Compliance Tool Verified");

    // 2b. Tools List must include real utilities
    console.log("Verifying Tools Catalog (fs/ls, fs/read_file)...");
    const listRes: any = await rpcCall('tools/list', {});
    const tools = listRes.result?.tools || [];
    const names = new Set(tools.map((t: any) => t.name));
    if (!names.has('__echo') || !names.has('fs/ls') || !names.has('fs/read_file')) {
        console.error(listRes);
        throw new Error('Tools list missing required tools');
    }
    console.log("✅ Tool Catalog Verified");

    // 2c. Filesystem Tools: must work within Roots
    console.log("Verifying FileSystem Tools (fs/ls, fs/read_file)...");
    const lsRes: any = await rpcCall('tools/call', {
        name: 'fs/ls',
        arguments: { path: '.' }
    });
    const entries = lsRes?.result?.entries ?? lsRes?.result?.result?.entries;
    if (!Array.isArray(entries)) {
        console.error(lsRes);
        throw new Error('fs/ls returned invalid shape');
    }

    const readRes: any = await rpcCall('tools/call', {
        name: 'fs/read_file',
        arguments: { path: 'package.json', max_bytes: 2048 }
    });
    const content = readRes?.result?.content ?? readRes?.result?.result?.content;
    if (typeof content !== 'string' || !content.includes('"name"')) {
        console.error(readRes);
        throw new Error('fs/read_file failed to read package.json');
    }
    console.log("✅ FileSystem Tools Verified");

    // 2d. Roots Security: traversal must be denied
    console.log("Verifying Roots Security (deny traversal)...");
    const rootsRes: any = await rpcCall('tools/call', {
        name: 'fs/ls',
        arguments: { path: '..' }
    });
    if (rootsRes?.error?.code !== -32602) {
        console.error(rootsRes);
        throw new Error('Roots security check failed - expected -32602');
    }
    console.log("✅ Roots Security Verified");

    // 3. Fuzz Test
    console.log("Running Fuzz/Negative Test...");
    const fuzzRes: any = await rpcCall('tools/call', { name: "non_existent_tool" });
    if (fuzzRes.error?.code !== -32601) { // Method Not Found
        throw new Error("Fuzz test failed - server did not return correct error code");
    }
    console.log("✅ Error Handling Verified");

    // 4. Timeout Check
    console.log("Running Timeout Test...");
    const timeoutRes: any = await rpcCall('tools/call', {
        name: '__echo',
        arguments: { message: 'slow', delay_ms: 31_000 }
    });
    if (timeoutRes.error?.code !== -32000) {
        console.error(timeoutRes);
        throw new Error('Timeout test failed - server did not return -32000');
    }
    console.log("✅ Timeout Handling Verified");

    // 5. Concurrency / Overload: allow success or 429 / timeout errors
    console.log("Running Concurrency/Overload Test...");
    const calls = Array.from({ length: 50 }).map(() => rpcCall('tools/call', {
        name: '__echo',
        arguments: { message: 'ping' }
    }));
    const results: any[] = await Promise.all(calls);
    const bad = results.find(r => r?.error && ![-32000].includes(r.error.code));
    if (bad) {
        // We tolerate timeouts; other errors indicate instability.
        console.error(bad);
        throw new Error('Concurrency test failed - unexpected error');
    }
    console.log("✅ Concurrency Verified");

    console.log("\n✨ ACTIVE ROBUSTNESS CERTIFIED ✨");
}

runInspection().catch(e => {
    console.error("FAILED:", e);
    process.exit(1);
});
