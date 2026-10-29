import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'mcpsoids_admin_session';
const CSRF_COOKIE = 'mcpsoids_csrf';
const SESSION_ID_COOKIE = 'mcpsoids_session_id';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

type AuthResult = {
    ok: boolean;
    status?: number;
    message?: string;
    issueSession?: boolean;
};

function getSecret(): string | null {
    return process.env.MCPSOIDS_UI_SECRET ||
        process.env.MCPSOIDS_ADMIN_TOKEN ||
        (process.env.NODE_ENV === 'production' ? null : 'mcpsoids-dev-secret');
}

function sign(value: string): string {
    const secret = getSecret();
    if (!secret) throw new Error('MCPSOIDS_UI_SECRET or MCPSOIDS_ADMIN_TOKEN must be set in production');
    return crypto.createHmac('sha256', secret).update(value).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
    const aBuffer = Buffer.from(a);
    const bBuffer = Buffer.from(b);
    return aBuffer.length === bBuffer.length && crypto.timingSafeEqual(aBuffer, bBuffer);
}

function createSignedValue(value: string): string {
    return `${value}.${sign(value)}`;
}

function verifySignedValue(signed: string | undefined): string | null {
    if (!signed) return null;
    const separator = signed.lastIndexOf('.');
    if (separator <= 0) return null;

    const value = signed.slice(0, separator);
    const signature = signed.slice(separator + 1);
    try {
        return safeEqual(signature, sign(value)) ? value : null;
    } catch {
        return null;
    }
}

function getPresentedAdminToken(request: NextRequest): string | null {
    const authorization = request.headers.get('authorization');
    if (authorization?.startsWith('Bearer ')) {
        return authorization.slice('Bearer '.length).trim();
    }
    return request.headers.get('x-mcpsoids-admin-token');
}

export function requireOperator(request: NextRequest): AuthResult {
    if (process.env.NODE_ENV !== 'production') {
        return { ok: true };
    }

    const adminToken = process.env.MCPSOIDS_ADMIN_TOKEN;
    if (!adminToken || !getSecret()) {
        return {
            ok: false,
            status: 500,
            message: 'Operator auth is not configured',
        };
    }

    const session = verifySignedValue(request.cookies.get(SESSION_COOKIE)?.value);
    const expiresAt = session?.startsWith('operator:') ? Number(session.slice('operator:'.length)) : 0;
    const now = Math.floor(Date.now() / 1000);
    if (Number.isSafeInteger(expiresAt) && expiresAt > now && expiresAt <= now + SESSION_MAX_AGE_SECONDS) {
        return { ok: true };
    }

    const presentedToken = getPresentedAdminToken(request);
    if (presentedToken && safeEqual(presentedToken, adminToken)) {
        return { ok: true, issueSession: true };
    }

    return {
        ok: false,
        status: 401,
        message: 'Operator session required',
    };
}

export function attachOperatorSession(response: NextResponse) {
    const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
    response.cookies.set(SESSION_COOKIE, createSignedValue(`operator:${expiresAt}`), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: SESSION_MAX_AGE_SECONDS,
    });
}

export function clearOperatorSession(response: NextResponse) {
    for (const name of [SESSION_COOKIE, CSRF_COOKIE, SESSION_ID_COOKIE]) {
        response.cookies.set(name, '', { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 });
    }
}

export function ensureSessionId(request: NextRequest, response: NextResponse): string {
    const existing = getVerifiedSessionId(request);
    if (existing) return existing;

    const sessionId = crypto.randomUUID();
    attachSessionId(response, sessionId);
    return sessionId;
}

export function getVerifiedSessionId(request: NextRequest): string | null {
    return verifySignedValue(request.cookies.get(SESSION_ID_COOKIE)?.value);
}

export function attachSessionId(response: NextResponse, sessionId: string) {
    response.cookies.set(SESSION_ID_COOKIE, createSignedValue(sessionId), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: SESSION_MAX_AGE_SECONDS,
    });
}

export function getSessionId(request: NextRequest): string {
    return verifySignedValue(request.cookies.get(SESSION_ID_COOKIE)?.value) ?? 'control-center-session';
}

export function issueCsrfToken(response: NextResponse): string {
    const csrfToken = createCsrfToken();
    attachCsrfToken(response, csrfToken);
    return csrfToken;
}

export function createCsrfToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

export function attachCsrfToken(response: NextResponse, csrfToken: string) {
    response.cookies.set(CSRF_COOKIE, createSignedValue(csrfToken), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: SESSION_MAX_AGE_SECONDS,
    });
}

export function validateCsrf(request: NextRequest): AuthResult {
    const csrfCookie = verifySignedValue(request.cookies.get(CSRF_COOKIE)?.value);
    const csrfHeader = request.headers.get('x-csrf-token');

    if (!csrfCookie || !csrfHeader || !safeEqual(csrfCookie, csrfHeader)) {
        return {
            ok: false,
            status: 403,
            message: 'Invalid CSRF token',
        };
    }

    return { ok: true };
}

export function jsonError(message: string, status: number) {
    return NextResponse.json({ error: { message } }, { status });
}
