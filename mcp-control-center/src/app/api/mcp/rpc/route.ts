import { NextRequest } from 'next/server';
import { getSessionId, jsonError, validateCsrf } from '@/lib/gateway-auth';
import { proxyMcpRpc, withOperator } from '@/lib/mcp-server';

type JsonRpcBody = {
    method?: unknown;
    params?: unknown;
};

function withSessionMetadata(body: unknown, sessionId: string) {
    const rpcBody = body as JsonRpcBody;
    if (rpcBody.method !== 'tools/call' || typeof rpcBody.params !== 'object' || rpcBody.params === null) {
        return body;
    }

    const params = rpcBody.params as Record<string, unknown>;
    return {
        ...(body as Record<string, unknown>),
        params: {
            ...params,
            sessionId,
            agentId: 'control-center-ui',
        },
    };
}

export async function POST(request: NextRequest) {
    const csrf = validateCsrf(request);
    if (!csrf.ok) {
        await request.text().catch(() => undefined);
        return jsonError(csrf.message ?? 'Invalid CSRF token', csrf.status ?? 403);
    }

    return withOperator(request, async () => {
        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return jsonError('Invalid JSON body', 400);
        }

        if (!body || typeof body !== 'object' || Array.isArray(body)) {
            return jsonError('Expected a JSON-RPC object', 400);
        }

        return proxyMcpRpc(withSessionMetadata(body, getSessionId(request)));
    });
}
