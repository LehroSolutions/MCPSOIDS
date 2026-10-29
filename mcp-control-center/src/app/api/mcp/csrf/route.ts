import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
    attachCsrfToken,
    attachOperatorSession,
    attachSessionId,
    createCsrfToken,
    getVerifiedSessionId,
    jsonError,
    requireOperator
} from '@/lib/gateway-auth';

export async function GET(request: NextRequest) {
    const auth = requireOperator(request);
    if (!auth.ok) {
        return jsonError(auth.message ?? 'Unauthorized', auth.status ?? 401);
    }

    const existingSessionId = getVerifiedSessionId(request);
    const sessionId = existingSessionId ?? crypto.randomUUID();
    const csrfToken = createCsrfToken();
    const response = NextResponse.json({ csrfToken, sessionId });

    if (!existingSessionId) {
        attachSessionId(response, sessionId);
    }
    attachCsrfToken(response, csrfToken);
    if (auth.issueSession) {
        attachOperatorSession(response);
    }
    return response;
}
