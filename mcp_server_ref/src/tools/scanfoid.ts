import { z } from 'zod';
import fs from 'fs';
import path from 'path';

export const ScanfoidToolSchema = z.object({
    operation: z.enum(['ingest_document', 'upload_payroll', 'get_payouts']),
    filePath: z.string().optional(),
    userId: z.string().optional().default('admin_user'),
    uploadId: z.string().optional(),
});

export type ScanfoidToolParams = z.infer<typeof ScanfoidToolSchema>;

const SCANFOID_URL = process.env.SCANFOID_URL || 'http://localhost:3010';

export async function handleScanfoid(params: any): Promise<string> {
    const validated = ScanfoidToolSchema.parse(params);

    if (validated.operation === 'upload_payroll') {
        if (!validated.filePath) {
            throw new Error('filePath is required for upload_payroll');
        }
        if (!fs.existsSync(validated.filePath)) {
            throw new Error(`File not found: ${validated.filePath}`);
        }

        const formData = new FormData();
        const fileBuffer = fs.readFileSync(validated.filePath);
        const fileName = path.basename(validated.filePath);

        // Node 18+ Blob/File support
        const blob = new Blob([fileBuffer]);
        formData.append('file', blob, fileName);

        const response = await fetch(`${SCANFOID_URL}/payroll/upload?userId=${validated.userId}`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            // Try to read error text
            const err = await response.text();
            throw new Error(`Scanfoid Upload Failed (${response.status}): ${err}`);
        }

        const data = await response.json();
        return JSON.stringify(data, null, 2);
    }

    if (validated.operation === 'get_payouts') {
        if (!validated.uploadId) throw new Error('uploadId is required for get_payouts');

        const response = await fetch(`${SCANFOID_URL}/payroll/payouts/${validated.uploadId}`, {
            method: 'GET'
        });

        const data = await response.json();
        return JSON.stringify(data, null, 2);
    }

    return "Operation not implemented yet";
}

export const SCANFOID_TOOL_DEFINITION = {
    name: "doc_operations",
    description: "Performs document and payroll operations via SCANFOID. Uploads payroll XLSX files or checks status.",
    inputSchema: {
        type: "object",
        properties: {
            operation: {
                type: "string",
                enum: ['ingest_document', 'upload_payroll', 'get_payouts']
            },
            filePath: { type: "string", description: "Absolute path to the file (for uploads)" },
            userId: { type: "string", description: "User ID performing action" },
            uploadId: { type: "string", description: "ID of previous upload (for status/payouts)" }
        },
        required: ["operation"]
    }
};
