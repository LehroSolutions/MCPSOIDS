import { z } from 'zod';

export const BusinsistoidToolSchema = z.object({
    operation: z.enum(['get_ambassador_status', 'list_active_campaigns', 'flag_issue']),
    userId: z.string().optional(),
    context: z.string().optional(),
    token: z.string().optional(),
});

export type BusinsistoidToolParams = z.infer<typeof BusinsistoidToolSchema>;

// Default to port 4000 as per index.ts
const BUSINSISTOID_URL = process.env.BUSINSISTOID_URL || 'http://localhost:4000/api';

// Helper to authenticate if no token provided (Quick & Dirty for MVP)
async function getAdminToken(): Promise<string> {
    const credentials = {
        email: 'admin@example.com',
        password: 'password123'
    };
    try {
        const response = await fetch(`${BUSINSISTOID_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(credentials)
        });
        if (!response.ok) throw new Error('Auth failed');
        const data = await response.json() as any;
        return data.token; // Adjust based on actual response shape
    } catch (e) {
        console.error("Failed to auto-login to Businsistoid", e);
        return "";
    }
}

export async function handleBusinsistoid(params: any): Promise<string> {
    const validated = BusinsistoidToolSchema.parse(params);
    let token = validated.token;

    // Auto-auth if needed
    if (!token) {
        token = await getAdminToken();
    }

    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    if (validated.operation === 'get_ambassador_status') {
        // Use the 'users' endpoint and filter or 'checkins' endpoint
        // For MVP, let's fetch checkins/all and filter by userId if provided, or return recent stats
        const response = await fetch(`${BUSINSISTOID_URL}/checkins/all?limit=5`, { headers });
        if (!response.ok) {
            return `Error fetching status: ${response.status} ${response.statusText}`;
        }
        const data = await response.json();
        return JSON.stringify(data, null, 2);
    }

    if (validated.operation === 'list_active_campaigns') {
        // Capability not yet found in API, return placeholder
        return "Campaign management is currently under development. No active campaigns found.";
    }

    if (validated.operation === 'flag_issue') {
        if (!validated.context) return "Error: Context required to flag issue.";

        // Use the AI agent to log this
        const payload = {
            message: `[SYSTEM ALERT] Issue Flagged: ${validated.context}`
        };
        const response = await fetch(`${BUSINSISTOID_URL}/agent`, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) return `Failed to flag issue: ${await response.text()}`;
        return `Issue flagged successfully. Agent response: ${await response.text()}`;
    }

    return "Operation not implemented";
}

export const BUSINSISTOID_TOOL_DEFINITION = {
    name: "brand_management",
    description: "Connects to BUSINSISTOID to manage brand ambassadors, check-ins, and issues.",
    inputSchema: {
        type: "object",
        properties: {
            operation: {
                type: "string",
                enum: ['get_ambassador_status', 'list_active_campaigns', 'flag_issue']
            },
            userId: { type: "string", description: "Optional User ID for status checks" },
            context: { type: "string", description: "Context info for flagging issues" },
            token: { type: "string", description: "JWT Token if available" }
        },
        required: ["operation"]
    }
};
