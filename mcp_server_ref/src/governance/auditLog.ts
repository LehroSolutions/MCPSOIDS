import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
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

const SENSITIVE_PATTERNS: Array<{ flag: string; pattern: RegExp }> = [
    { flag: 'contains_email', pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
    { flag: 'contains_sa_id_candidate', pattern: /\b\d{13}\b/ },
    { flag: 'contains_credit_card_candidate', pattern: /\b(?:\d[ -]?){13,16}\b/ },
    { flag: 'contains_secret_keyword', pattern: /\b(password|secret|api[_-]?key|token|private[_-]?key)\b/i },
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
    return SENSITIVE_PATTERNS
        .filter(({ pattern }) => pattern.test(serialized))
        .map(({ flag }) => flag);
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
        const cleaned: Record<string, unknown> = {};
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

    constructor(private readonly filePath: string) { }

    public getPath(): string {
        return this.filePath;
    }

    public async append(draft: AuditEntryDraft): Promise<AuditEntry> {
        let entry!: AuditEntry;

        this.appendQueue = this.appendQueue.then(async () => {
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
            await fs.appendFile(this.filePath, `${JSON.stringify(entry)}\n`, 'utf8');
        });

        await this.appendQueue;
        return entry;
    }

    public async readRecent(limit = 100): Promise<AuditEntry[]> {
        const entries = await this.readAll();
        return entries.slice(Math.max(entries.length - limit, 0)).reverse();
    }

    public async verifyIntegrity(): Promise<ChainVerificationResult> {
        const entries = await this.readAll();
        let previous = GENESIS_HASH;

        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];

            if (entry.prevEntryHash !== previous) {
                return {
                    valid: false,
                    checkedEntries: entries.length,
                    tamperDetectedAt: i,
                    suspectEntryId: entry.id,
                    reason: 'Previous hash mismatch',
                };
            }

            const expectedHash = computeEntryHash(redactEntryForHash(entry));
            if (entry.entryHash !== expectedHash) {
                return {
                    valid: false,
                    checkedEntries: entries.length,
                    tamperDetectedAt: i,
                    suspectEntryId: entry.id,
                    reason: 'Entry hash mismatch',
                };
            }

            previous = entry.entryHash;
        }

        return {
            valid: true,
            checkedEntries: entries.length,
        };
    }

    private async getLastEntryHash(): Promise<string> {
        const entries = await this.readAll();
        return entries.at(-1)?.entryHash ?? GENESIS_HASH;
    }

    private async readAll(): Promise<AuditEntry[]> {
        try {
            const content = await fs.readFile(this.filePath, 'utf8');
            return content
                .split(/\r?\n/)
                .filter(Boolean)
                .map((line) => JSON.parse(line) as AuditEntry);
        } catch (err) {
            if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
                return [];
            }
            throw err;
        }
    }
}
