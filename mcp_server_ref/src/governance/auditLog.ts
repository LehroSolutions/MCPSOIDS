import crypto from 'crypto';
import fs from 'fs/promises';
import type { FileHandle } from 'fs/promises';
import path from 'path';
import { createInterface } from 'readline';
import { PolicyDecision } from './policyEngine';

export type AuditOutcome = 'allowed' | 'denied' | 'error';

export type AuditEntry = {
  id: string;
  timestamp: string;
  requestId: string | number | null;
  sessionId: string;
  agentId: string;
  action: 'tools/call';
  toolName: string;
  outcome: AuditOutcome;
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

export type AuditEntryDraft = Omit<AuditEntry, 'id' | 'timestamp' | 'prevEntryHash' | 'entryHash'>;

export type ChainVerificationResult = {
  valid: boolean;
  checkedEntries: number;
  tamperDetectedAt?: number;
  suspectEntryId?: string;
  reason?: string;
};

const GENESIS_HASH = 'GENESIS';

const TAIL_READ_BYTES = 64 * 1024;

const SENSITIVE_PATTERNS: Array<{ flag: string; pattern: RegExp }> = [
  { flag: 'contains_email', pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { flag: 'contains_sa_id_candidate', pattern: /\b\d{13}\b/ },
  { flag: 'contains_credit_card_candidate', pattern: /\b(?:\d[ -]?){13,16}\b/ },
  {
    flag: 'contains_secret_keyword',
    pattern: /\b(password|secret|api[_-]?key|token|private[_-]?key)\b/i,
  },
];

function canonicalize(value: unknown): string {
  if (value === undefined) {
    return 'null';
  }

  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(record[key])}`)
    .join(',')}}`;
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function hashPayload(payload: unknown): string {
  return sha256(canonicalize(payload));
}

export function detectSensitiveFlags(payload: unknown): string[] {
  const serialized = canonicalize(payload);
  return SENSITIVE_PATTERNS.filter(({ pattern }) => pattern.test(serialized)).map(
    ({ flag }) => flag,
  );
}

export function getPayloadSizeBytes(payload: unknown): number {
  return Buffer.byteLength(canonicalize(payload), 'utf8');
}

function computeEntryHash(entry: Omit<AuditEntry, 'entryHash'>): string {
  return sha256(canonicalize(entry));
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(stripUndefined) as T;
  }

  if (value && typeof value === 'object') {
    // Null prototype: JSON-derived `__proto__` keys then become plain own
    // properties instead of invoking the prototype setter.
    const cleaned: Record<string, unknown> = Object.create(null);
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (item !== undefined) {
        cleaned[key] = stripUndefined(item);
      }
    }
    return cleaned as T;
  }

  return value;
}

function redactEntryForHash(entry: AuditEntry): Omit<AuditEntry, 'entryHash'> {
  const withoutEntryHash = { ...entry };
  delete (withoutEntryHash as Partial<AuditEntry>).entryHash;
  return withoutEntryHash;
}

export class AuditLog {
  private appendQueue: Promise<void> = Promise.resolve();

  private lastEntryHash: string | null = null;

  constructor(private readonly filePath: string) {}

  public getPath(): string {
    return this.filePath;
  }

  public async append(draft: AuditEntryDraft): Promise<AuditEntry> {
    let entry!: AuditEntry;

    const operation = this.appendQueue.then(async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });

      const prevEntryHash = await this.getLastEntryHash();
      const entryWithoutHash = stripUndefined({
        ...draft,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        prevEntryHash,
      });
      const entryHash = computeEntryHash(entryWithoutHash);
      entry = { ...entryWithoutHash, entryHash };
      await fs.appendFile(this.filePath, `${JSON.stringify(entry)}\n`, {
        encoding: 'utf8',
        flush: true,
      });
      this.lastEntryHash = entryHash;
    });

    this.appendQueue = operation.catch(() => {
      this.lastEntryHash = null;
    });
    await operation;
    return entry;
  }

  public async readRecent(limit = 100): Promise<AuditEntry[]> {
    if (!Number.isSafeInteger(limit) || limit < 1)
      throw new Error('Audit limit must be a positive integer');
    let handle: FileHandle;
    try {
      handle = await fs.open(this.filePath, 'r');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
    try {
      let position = (await handle.stat()).size;
      let pending: Buffer = Buffer.alloc(0);
      const entries: AuditEntry[] = [];
      while (position > 0 && entries.length < limit) {
        const length = Math.min(position, TAIL_READ_BYTES);
        position -= length;
        const chunk = Buffer.alloc(length);
        const { bytesRead } = await handle.read(chunk, 0, length, position);
        if (bytesRead !== length) throw new Error('Audit log changed during read');
        const data = Buffer.concat([chunk, pending]);
        let end = data.length;
        while (end > 0 && entries.length < limit) {
          const newline = data.lastIndexOf(10, end - 1);
          if (newline < 0) break;
          const line = data.subarray(newline + 1, end).toString('utf8');
          if (line.trim()) entries.push(JSON.parse(line) as AuditEntry);
          end = newline;
        }
        pending = data.subarray(0, end);
        if (position === 0 && pending.length > 0 && entries.length < limit) {
          const line = pending.toString('utf8');
          if (line.trim()) entries.push(JSON.parse(line) as AuditEntry);
        }
      }
      return entries;
    } finally {
      await handle.close();
    }
  }

  public async verifyIntegrity(): Promise<ChainVerificationResult> {
    let handle: FileHandle;
    try {
      handle = await fs.open(this.filePath, 'r');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT')
        return { valid: true, checkedEntries: 0 };
      throw err;
    }
    const reader = createInterface({
      input: handle.createReadStream({ encoding: 'utf8', autoClose: false }),
      crlfDelay: Infinity,
    });
    let previous = GENESIS_HASH;
    let checkedEntries = 0;
    try {
      for await (const line of reader) {
        if (!line.trim()) continue;
        const entry = JSON.parse(line) as AuditEntry;
        const i = checkedEntries++;

        if (entry.prevEntryHash !== previous) {
          return {
            valid: false,
            checkedEntries,
            tamperDetectedAt: i,
            suspectEntryId: entry.id,
            reason: 'Previous hash mismatch',
          };
        }

        const expectedHash = computeEntryHash(redactEntryForHash(entry));
        if (entry.entryHash !== expectedHash) {
          return {
            valid: false,
            checkedEntries,
            tamperDetectedAt: i,
            suspectEntryId: entry.id,
            reason: 'Entry hash mismatch',
          };
        }

        previous = entry.entryHash;
      }

      return {
        valid: true,
        checkedEntries,
      };
    } finally {
      reader.close();
      await handle.close();
    }
  }

  private async getLastEntryHash(): Promise<string> {
    if (this.lastEntryHash === null) {
      this.lastEntryHash = await this.readLastEntryHash();
    }
    return this.lastEntryHash;
  }

  private async readLastEntryHash(): Promise<string> {
    return (await this.readRecent(1))[0]?.entryHash ?? GENESIS_HASH;
  }
}
