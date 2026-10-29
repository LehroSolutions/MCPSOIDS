import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { AuditLog, type AuditEntryDraft } from '../src/governance/auditLog';

let logDir = '';
let sequence = 0;

beforeAll(() => {
  logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcpsoids-audit-'));
});

afterAll(() => {
  if (logDir && path.basename(logDir).startsWith('mcpsoids-audit-')) {
    fs.rmSync(logDir, { recursive: true, force: true });
  }
});

// Each test gets its own file so chain assertions start from GENESIS and do not
// leak state into one another through the shared on-disk log.
function freshLogPath(): string {
  sequence += 1;
  return path.join(logDir, `audit-${sequence}.jsonl`);
}

function draft(overrides: Partial<AuditEntryDraft> = {}): AuditEntryDraft {
  return {
    requestId: null,
    sessionId: 'session-under-test',
    agentId: 'agent-under-test',
    action: 'tools/call',
    toolName: '__echo',
    outcome: 'allowed',
    policy: {
      allowed: true,
      effect: 'allow',
      enforced: true,
      mode: 'enforce',
      policyId: 'default',
      reason: 'no policy matched',
    },
    latencyMs: 5,
    inputHash: 'a'.repeat(64),
    inputSensitiveFlags: [],
    outputHash: 'b'.repeat(64),
    outputSizeBytes: 32,
    outputSensitiveFlags: [],
    ...overrides,
  };
}

describe('AuditLog hash chain', () => {
  test('produces a verifiable chain across many appends', async () => {
    const log = new AuditLog(freshLogPath());
    for (let index = 0; index < 25; index += 1) {
      await log.append(draft({ toolName: `__echo-${index}` }));
    }

    const result = await log.verifyIntegrity();
    expect(result.valid).toBe(true);
    expect(result.checkedEntries).toBe(25);
  });

  test('a fresh instance continues the chain of an existing log', async () => {
    const firstPath = freshLogPath();
    const first = new AuditLog(firstPath);
    const written = await first.append(draft({ toolName: '__echo-first-instance' }));
    expect(written.prevEntryHash).toBe('GENESIS');

    const second = new AuditLog(firstPath);
    const next = await second.append(draft({ toolName: '__echo-second-instance' }));
    expect(next.prevEntryHash).toBe(written.entryHash);

    const result = await second.verifyIntegrity();
    expect(result.valid).toBe(true);
    expect(result.checkedEntries).toBe(2);
  });

  test('detects tampering with a persisted entry', async () => {
    const tamperPath = freshLogPath();
    const tamperLog = new AuditLog(tamperPath);
    await tamperLog.append(draft({ toolName: '__echo-to-tamper' }));

    const raw = fs.readFileSync(tamperPath, 'utf8').split('\n').filter(Boolean);
    const target = JSON.parse(raw[0]) as Record<string, unknown>;
    target.toolName = '__tampered';
    raw[0] = JSON.stringify(target);
    fs.writeFileSync(tamperPath, `${raw.join('\n')}\n`, 'utf8');

    const result = await tamperLog.verifyIntegrity();
    expect(result.valid).toBe(false);
  });

  test('readRecent does not return unbounded entries', async () => {
    const log = new AuditLog(freshLogPath());
    const recent = await log.readRecent(5);
    expect(recent.length).toBeLessThanOrEqual(5);
  });

  test('an empty log verifies as an intact chain', async () => {
    const emptyPath = freshLogPath();
    const log = new AuditLog(emptyPath);
    const result = await log.verifyIntegrity();
    expect(result.valid).toBe(true);
  });
});
