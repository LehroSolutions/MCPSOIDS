import { afterEach, beforeEach, expect, test, spyOn } from 'bun:test';
import { NextRequest, NextResponse } from 'next/server';
import { attachOperatorSession, requireOperator } from '../src/lib/gateway-auth';

const originalEnv = { ...process.env };
let clock;
const now = 1800000000000;

beforeEach(() => {
  process.env.NODE_ENV = 'production';
  process.env.MCPSOIDS_ADMIN_TOKEN = 'test-admin-token';
  process.env.MCPSOIDS_UI_SECRET = 'test-ui-secret';
  clock = spyOn(Date, 'now').mockReturnValue(now);
});

afterEach(() => {
  clock.mockRestore();
  process.env.NODE_ENV = originalEnv.NODE_ENV;
  for (const key of ['MCPSOIDS_ADMIN_TOKEN', 'MCPSOIDS_UI_SECRET']) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

function sessionRequest() {
  const response = NextResponse.json({});
  attachOperatorSession(response);
  const cookie = response.cookies.get('mcpsoids_admin_session');
  return new NextRequest('https://control.example/api/mcp/health', { headers: { cookie: `${cookie.name}=${cookie.value}` } });
}

test('production requires a configured operator token', () => {
  expect(requireOperator(new NextRequest('https://control.example')).status).toBe(401);
  delete process.env.MCPSOIDS_ADMIN_TOKEN;
  expect(requireOperator(new NextRequest('https://control.example')).status).toBe(500);
});

test('accepts a valid session and rejects replay after its signed expiry', () => {
  const request = sessionRequest();
  expect(requireOperator(request).ok).toBe(true);
  clock.mockReturnValue(now + 8 * 60 * 60 * 1000);
  expect(requireOperator(request).status).toBe(401);
});

test('rotating the signing secret revokes issued sessions', () => {
  const request = sessionRequest();
  process.env.MCPSOIDS_UI_SECRET = 'rotated-test-secret';
  expect(requireOperator(request).status).toBe(401);
});
