import { NextRequest, NextResponse } from 'next/server';
import { attachOperatorSession, jsonError, requireOperator } from './gateway-auth';

const PRIVATE_IP_PATTERNS = [
    /^localhost$/i,
    /^127\.\d+\.\d+\.\d+$/,
    /^10\.\d+\.\d+\.\d+$/,
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
    /^192\.168\.\d+\.\d+$/,
    /^169\.254\.\d+\.\d+$/,
    /^::1$/,
    /^fc00:/i,
    /^fe80:/i,
];

function getMcpServerUrl(): URL {
    const rawUrl = process.env.MCP_SERVER_URL ?? 'http://localhost:3000';
    let parsed: URL;

    try {
        parsed = new URL(rawUrl);
    } catch {
        throw new Error('Invalid MCP_SERVER_URL');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('MCP_SERVER_URL must use http or https');
    }

    if (
        process.env.NODE_ENV === 'production' &&
        process.env.MCPSOIDS_ALLOW_PRIVATE_MCP !== 'true' &&
        PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(parsed.hostname))
    ) {
        throw new Error('MCP_SERVER_URL cannot target localhost or private IPs in production');
    }

    return parsed;
}

function backendHeaders(): HeadersInit {
    const token = process.env.MCP_AUTH_TOKEN;
    return {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
    };
}

export async function withOperator(
    request: NextRequest,
    handler: () => Promise<NextResponse>
): Promise<NextResponse> {
    const auth = requireOperator(request);
    if (!auth.ok) {
        return jsonError(auth.message ?? 'Unauthorized', auth.status ?? 401);
    }

    let response: NextResponse;
    try {
        response = await handler();
    } catch (error) {
        const timedOut = error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name);
        return jsonError(timedOut ? 'MCP backend timed out' : 'MCP backend unavailable', timedOut ? 504 : 502);
    }
    if (auth.issueSession) {
        attachOperatorSession(response);
    }
    return response;
}

export async function proxyMcpGet(pathname: string): Promise<NextResponse> {
    const serverUrl = getMcpServerUrl();
    const target = new URL(pathname, serverUrl);

    const response = await fetch(target, {
        headers: backendHeaders(),
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
        redirect: 'error',
    });
    const body = await response.text();
    const contentType = response.headers.get('content-type') ?? 'application/json';

    return new NextResponse(body, {
        status: response.status,
        headers: {
            'content-type': contentType,
        },
    });
}

export async function proxyMcpRpc(body: unknown): Promise<NextResponse> {
    const serverUrl = getMcpServerUrl();
    const target = new URL('/mcp', serverUrl);

    const response = await fetch(target, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            ...backendHeaders(),
        },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
        redirect: 'error',
    });
    const responseBody = await response.text();
    const contentType = response.headers.get('content-type') ?? 'application/json';

    return new NextResponse(responseBody, {
        status: response.status,
        headers: {
            'content-type': contentType,
        },
    });
}
