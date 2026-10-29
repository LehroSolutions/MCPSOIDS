import { NextRequest, NextResponse } from 'next/server';
import { clearOperatorSession, jsonError, validateCsrf } from '@/lib/gateway-auth';

export async function POST(request: NextRequest) {
    const csrf = validateCsrf(request);
    if (!csrf.ok) return jsonError(csrf.message ?? 'Invalid CSRF token', 403);
    const response = NextResponse.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
    clearOperatorSession(response);
    return response;
}
