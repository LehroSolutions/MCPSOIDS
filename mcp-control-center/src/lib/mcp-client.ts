export type JsonObject = Record<string, unknown>;

export type HealthStatus = {
    status: 'green' | 'yellow' | 'red';
    metrics: {
        uptime_seconds: number;
        memory_usage_mb: number;
        active_requests: number;
        active_connections?: number;
        error_rate_1m?: number;
    };
    self_heal_hint?: string;
};

export type PolicyDecision = {
    allowed: boolean;
    effect: 'allow' | 'deny';
    enforced: boolean;
    mode: 'enforce' | 'dry-run';
    policyId: string;
    reason: string;
    matchedPattern?: string;
};

export type AuditEntry = {
    id: string;
    timestamp: string;
    requestId: string | number | null;
    sessionId: string;
    agentId: string;
    action: 'tools/call';
    toolName: string;
    outcome: 'allowed' | 'denied' | 'error';
    policy: PolicyDecision;
    latencyMs: number;
    inputHash: string;
    inputSensitiveFlags: string[];
    outputHash?: string;
    outputSizeBytes: number;
    outputSensitiveFlags: string[];
    errorCode?: number;
    errorHash?: string;
    prevEntryHash: string;
    entryHash: string;
};

export type AuditIntegrity = {
    valid: boolean;
    checkedEntries: number;
    tamperDetectedAt?: number;
    suspectEntryId?: string;
    reason?: string;
};

type JsonRpcResponse<T> = {
    jsonrpc: '2.0';
    id: string | number | null;
    result?: T;
    error?: { code?: number; message: string; data?: unknown };
};

type CsrfResponse = {
    csrfToken: string;
    sessionId: string;
};

const DEFAULT_TIMEOUT_MS = 10_000;
const OPERATOR_TOKEN_KEY = 'mcpsoids.operatorToken';

let csrfToken: string | null = null;
let csrfRequest: Promise<string> | null = null;

function operatorHeaders(): Record<string, string> {
    if (typeof window === 'undefined') return {};
    const token = window.sessionStorage.getItem(OPERATOR_TOKEN_KEY);
    return token ? { 'x-mcpsoids-admin-token': token } : {};
}

export function setOperatorToken(token: string) {
    csrfToken = null;
    if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(OPERATOR_TOKEN_KEY, token);
    }
}

export function clearOperatorToken() {
    csrfToken = null;
    if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(OPERATOR_TOKEN_KEY);
    }
}

export async function endOperatorSession(): Promise<void> {
    const token = await getCsrfToken();
    const response = await fetch('/api/mcp/logout', {
        method: 'POST', headers: { 'x-csrf-token': token }, credentials: 'same-origin',
    });
    await parseJsonResponse(response);
    clearOperatorToken();
}

function extractErrorMessage(payload: unknown, fallback: string): string {
    if (
        payload &&
        typeof payload === 'object' &&
        'error' in payload &&
        payload.error &&
        typeof payload.error === 'object' &&
        'message' in payload.error &&
        typeof payload.error.message === 'string'
    ) {
        return payload.error.message;
    }
    return fallback;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(extractErrorMessage(payload, `Request failed (${response.status})`));
    }
    return payload as T;
}

async function getCsrfToken(forceRefresh = false): Promise<string> {
    if (csrfToken && !forceRefresh) return csrfToken;
    if (csrfRequest && !forceRefresh) return csrfRequest;

    csrfRequest = fetch('/api/mcp/csrf', {
        method: 'GET',
        headers: operatorHeaders(),
        cache: 'no-store',
        credentials: 'same-origin',
    })
        .then((response) => parseJsonResponse<CsrfResponse>(response))
        .then((payload) => {
            csrfToken = payload.csrfToken;
            csrfRequest = null;
            return payload.csrfToken;
        })
        .catch((error) => {
            csrfRequest = null;
            throw error;
        });

    return csrfRequest;
}

export async function fetchHealth(): Promise<HealthStatus> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    try {
        const res = await fetch('/api/mcp/health', {
            headers: operatorHeaders(),
            signal: controller.signal,
            cache: 'no-store',
            credentials: 'same-origin',
        });
        return parseJsonResponse<HealthStatus>(res);
    } finally {
        clearTimeout(timeout);
    }
}

export async function jsonRpcCall<T>(method: string, params: unknown = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    async function send(forceCsrfRefresh = false) {
        const token = await getCsrfToken(forceCsrfRefresh);
        return fetch('/api/mcp/rpc', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'x-csrf-token': token,
                ...operatorHeaders(),
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: crypto.randomUUID(),
                method,
                params,
            }),
            signal: controller.signal,
            cache: 'no-store',
            credentials: 'same-origin',
        });
    }

    try {
        let res = await send(false);
        if (res.status === 403) {
            csrfToken = null;
            res = await send(true);
        }

        const data = await parseJsonResponse<JsonRpcResponse<T>>(res);
        if (data.error) throw new Error(data.error.message);
        if (data.result === undefined) throw new Error('Invalid JSON-RPC response');
        return data.result;
    } finally {
        clearTimeout(timeout);
    }
}

export async function fetchAuditEntries(limit = 20): Promise<AuditEntry[]> {
    const response = await fetch(`/api/mcp/audit?limit=${encodeURIComponent(String(limit))}`, {
        headers: operatorHeaders(),
        cache: 'no-store',
        credentials: 'same-origin',
    });
    const payload = await parseJsonResponse<{ entries: AuditEntry[] }>(response);
    return payload.entries;
}

export async function fetchAuditIntegrity(): Promise<AuditIntegrity> {
    const response = await fetch('/api/mcp/audit/integrity', {
        headers: operatorHeaders(),
        cache: 'no-store',
        credentials: 'same-origin',
    });
    return parseJsonResponse<AuditIntegrity>(response);
}
