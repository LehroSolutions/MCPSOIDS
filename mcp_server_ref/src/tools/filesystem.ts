import fs from 'fs/promises';
import type { Dirent } from 'fs';
import { z } from 'zod';
import { SecurityManager } from '../features/security';

const MAX_READ_BYTES = 256 * 1024;

export const LsToolSchema = z.object({
    path: z.string().optional().default('.'),
});

export type LsToolParams = z.infer<typeof LsToolSchema>;

export const ReadFileToolSchema = z.object({
    path: z.string(),
    encoding: z.enum(['utf8']).optional().default('utf8'),
    max_bytes: z.number().int().positive().max(MAX_READ_BYTES).optional().default(MAX_READ_BYTES),
});

export type ReadFileToolParams = z.infer<typeof ReadFileToolSchema>;

export async function handleLs(params: unknown, security: SecurityManager) {
    const validated = LsToolSchema.parse(params);
    const resolved = security.validatePath(validated.path);

    const dirents = await fs.readdir(resolved, { withFileTypes: true });

    const entries = dirents
        .map((d: Dirent) => ({
            name: d.name,
            type: d.isDirectory() ? 'directory' : d.isFile() ? 'file' : 'other',
        }))
        .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name));

    return {
        path: resolved,
        entries,
    };
}

export async function handleReadFile(params: unknown, security: SecurityManager) {
    const validated = ReadFileToolSchema.parse(params);
    const resolved = security.validatePath(validated.path);

    const stat = await fs.stat(resolved);
    if (!stat.isFile()) {
        throw new Error(`Invalid path: ${resolved} is not a file`);
    }

    const maxBytes = validated.max_bytes;
    const readBytes = Math.min(stat.size, maxBytes);
    const fh = await fs.open(resolved, 'r');

    try {
        const buffer = Buffer.alloc(readBytes);
        const { bytesRead } = await fh.read(buffer, 0, readBytes, 0);
        const content = buffer.subarray(0, bytesRead).toString(validated.encoding);

        return {
            path: resolved,
            bytes: bytesRead,
            truncated: stat.size > bytesRead,
            content,
        };
    } finally {
        await fh.close();
    }
}

export const LS_TOOL_DEFINITION = {
    name: 'fs/ls',
    description: 'List directory entries within the configured Roots. Used to prove Roots security.',
    inputSchema: {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'Directory path, must be within Roots. Defaults to current root.' },
        },
    },
};

export const READ_FILE_TOOL_DEFINITION = {
    name: 'fs/read_file',
    description: 'Read a text file within the configured Roots with a strict size cap (prevents unbounded reads).',
    inputSchema: {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'File path within Roots.' },
            encoding: { type: 'string', enum: ['utf8'], default: 'utf8' },
            max_bytes: { type: 'number', description: `Maximum bytes to read (<= ${MAX_READ_BYTES}).`, default: MAX_READ_BYTES },
        },
        required: ['path'],
    },
};
