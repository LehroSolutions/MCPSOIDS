import { afterEach, expect, spyOn, test } from 'bun:test';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { AuditLog, type AuditEntryDraft } from '../src/governance/auditLog';

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (
      path.dirname(path.resolve(root)) !== path.resolve(os.tmpdir()) ||
      !path.basename(root).startsWith('mcp-audit-recovery-')
    )
      throw new Error('Unsafe fixture cleanup');
    await fs.rm(root, { recursive: true, force: true });
  }
});

const draft = (requestId: number): AuditEntryDraft => ({
  requestId,
  sessionId: 'synthetic-session',
  agentId: 'synthetic-agent',
  action: 'tools/call',
  toolName: '__echo',
  outcome: 'allowed',
  policy: {
    allowed: true,
    effect: 'allow',
    enforced: true,
    mode: 'enforce',
    policyId: 'default',
    reason: 'test fixture',
  },
  latencyMs: 1,
  inputHash: 'a'.repeat(64),
  inputSensitiveFlags: [],
  outputHash: 'b'.repeat(64),
  outputSizeBytes: 10,
  outputSensitiveFlags: [],
});
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-audit-recovery-'));
  roots.push(root);
  const file = path.join(root, 'audit.jsonl');
  return { file, log: new AuditLog(file) };
}

test('a failed audit write rejects that request and recovers without a phantom entry', async () => {
  const { file, log } = await fixture();
  const first = await log.append(draft(1));
  const backup = file + '.saved';
  await fs.rename(file, backup);
  await fs.mkdir(file);
  await expect(log.append(draft(2))).rejects.toThrow();
  await fs.rmdir(file);
  await fs.rename(backup, file);
  const recovered = await log.append(draft(3));
  expect(recovered.prevEntryHash).toBe(first.entryHash);
  expect((await log.readRecent(3)).map((entry) => entry.requestId)).toEqual([3, 1]);
  expect(await log.verifyIntegrity()).toEqual({ valid: true, checkedEntries: 2 });
});

test('recent reads and integrity verification avoid loading the whole log into memory', async () => {
  const { file, log } = await fixture();
  await log.append(draft(1));
  await log.append(draft(2));
  const original = await fs.readFile(file, 'utf8');
  const wholeRead = spyOn(fs, 'readFile').mockImplementation(() => {
    throw new Error('Whole-file reads are forbidden during audit queries');
  });
  try {
    expect((await log.readRecent(1))[0].requestId).toBe(2);
    expect(await log.verifyIntegrity()).toEqual({ valid: true, checkedEntries: 2 });
    expect(wholeRead).not.toHaveBeenCalled();
  } finally {
    wholeRead.mockRestore();
  }
  expect(await fs.readFile(file, 'utf8')).toBe(original);
});

test('tail reads reconstruct oversized UTF-8 rows and preserve newest-first order', async () => {
  const { log } = await fixture();
  const large = '界'.repeat(40_000);
  await log.append({ ...draft(1), sessionId: large });
  await log.append(draft(2));
  const entries = await log.readRecent(2);
  expect(entries.map((entry) => entry.requestId)).toEqual([2, 1]);
  expect(entries[1].sessionId).toBe(large);
  expect(await log.verifyIntegrity()).toEqual({ valid: true, checkedEntries: 2 });
});

test('malformed audit history is preserved and blocks continuation until repaired', async () => {
  const { file, log } = await fixture();
  const broken = '{"incomplete":';
  await fs.writeFile(file, broken);
  await expect(log.append(draft(1))).rejects.toThrow();
  expect(await fs.readFile(file, 'utf8')).toBe(broken);
  await fs.writeFile(file, '');
  const recovered = await log.append(draft(2));
  expect(recovered.prevEntryHash).toBe('GENESIS');
  expect(await log.verifyIntegrity()).toEqual({ valid: true, checkedEntries: 1 });
});
