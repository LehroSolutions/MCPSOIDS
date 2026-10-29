import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { SecurityManager } from '../src/features/security';

let sandboxRoot = '';
let outsideRoot = '';

beforeAll(() => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mcpsoids-sec-'));
  sandboxRoot = path.join(base, 'allowed');
  outsideRoot = path.join(base, 'outside');
  fs.mkdirSync(sandboxRoot, { recursive: true });
  fs.mkdirSync(outsideRoot, { recursive: true });
  fs.writeFileSync(path.join(outsideRoot, 'secret.txt'), 'top-secret', 'utf8');
});

afterAll(() => {
  if (sandboxRoot && path.basename(path.dirname(sandboxRoot)).startsWith('mcpsoids-sec-')) {
    fs.rmSync(path.dirname(sandboxRoot), { recursive: true, force: true });
  }
});

describe('SecurityManager path containment', () => {
  test('allows a descendant of an allowed root', () => {
    const manager = new SecurityManager([sandboxRoot]);
    const target = path.join(sandboxRoot, 'notes.txt');
    expect(() => manager.validatePath(target)).not.toThrow();
  });

  test('allows the allowed root itself', () => {
    const manager = new SecurityManager([sandboxRoot]);
    expect(() => manager.validatePath(sandboxRoot)).not.toThrow();
  });

  test('blocks parent-directory traversal', () => {
    const manager = new SecurityManager([sandboxRoot]);
    expect(() =>
      manager.validatePath(path.join(sandboxRoot, '..', 'outside', 'secret.txt')),
    ).toThrow(/Security Violation/);
  });

  test('blocks an unrelated absolute path', () => {
    const manager = new SecurityManager([sandboxRoot]);
    expect(() => manager.validatePath(outsideRoot)).toThrow(/Security Violation/);
  });

  test('allows a not-yet-created write target inside the root', () => {
    const manager = new SecurityManager([sandboxRoot]);
    const fresh = path.join(sandboxRoot, 'new', 'nested', 'file.txt');
    expect(() => manager.validatePath(fresh)).not.toThrow();
  });

  test('blocks a not-yet-created write target outside the root', () => {
    const manager = new SecurityManager([sandboxRoot]);
    const fresh = path.join(outsideRoot, 'new', 'file.txt');
    expect(() => manager.validatePath(fresh)).toThrow(/Security Violation/);
  });

  test('rejection message does not disclose allowed root paths', () => {
    const manager = new SecurityManager([sandboxRoot]);
    let message = '';
    try {
      manager.validatePath(outsideRoot);
    } catch (err) {
      message = (err as Error).message;
    }
    expect(message).toContain('Security Violation');
    expect(message).not.toContain(sandboxRoot);
    expect(message).not.toContain(path.dirname(sandboxRoot));
  });
});

describe('SecurityManager symlink containment', () => {
  test('blocks a symlink that escapes an allowed root', () => {
    const linkPath = path.join(sandboxRoot, 'escape');
    let created = false;
    try {
      // Windows junctions to directories do not require elevation.
      fs.symlinkSync(outsideRoot, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
      created = true;
    } catch {
      // Filesystem does not support link creation here; the escape path cannot
      // be exercised, so skip rather than assert a false pass.
      return;
    }

    try {
      const manager = new SecurityManager([sandboxRoot]);
      expect(() => manager.validatePath(path.join(linkPath, 'secret.txt'))).toThrow(
        /Security Violation/,
      );
    } finally {
      if (created) {
        // Windows junctions are removed with unlink, not rm.
        try {
          fs.unlinkSync(linkPath);
        } catch {
          fs.rmSync(linkPath, { force: true });
        }
      }
    }
  });
});
