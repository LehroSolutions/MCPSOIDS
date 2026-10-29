type SchemaProperty = {
    type?: string | string[];
    enum?: unknown[];
    default?: unknown;
    maxLength?: number;
    maximum?: number;
    minimum?: number;
};

export type ToolInputSchema = {
    type?: string;
    properties?: Record<string, SchemaProperty>;
    required?: string[];
};

// Validate the form fields without dynamic code generation; the MCP server remains authoritative.
export function validateArgs(tool: { inputSchema?: ToolInputSchema }, args: Record<string, string>) {
    const data: Record<string, unknown> = Object.create(null);
    const errors: Record<string, string> = Object.create(null);
    const required = new Set(tool.inputSchema?.required ?? []);
    for (const [key, property] of Object.entries(tool.inputSchema?.properties ?? {})) {
        const raw = args[key] ?? '';
        if (!raw.trim()) {
            if (property.default !== undefined) data[key] = property.default;
            else if (required.has(key)) errors[key] = `${key} is required`;
            continue;
        }
        const types = Array.isArray(property.type) ? property.type : [property.type ?? 'string'];
        let value: unknown = raw;
        if (!types.includes('string')) {
            if (types.includes('number') || types.includes('integer')) {
                value = Number(raw);
                if (!Number.isFinite(value) || (types.includes('integer') && !types.includes('number') && !Number.isInteger(value))) errors[key] = `${key} must be a valid number`;
            } else if (types.includes('boolean')) {
                if (!['true', 'false'].includes(raw)) errors[key] = `${key} must be true or false`;
                value = raw === 'true';
            } else {
                try { value = JSON.parse(raw); } catch { errors[key] = `${key} must be valid JSON`; }
                const type = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
                if (!types.includes(type)) errors[key] = `${key} has an invalid type`;
            }
        }
        if (typeof value === 'string' && [...value].length > (property.maxLength ?? 4096)) errors[key] = `${key} is too long`;
        if (typeof value === 'number' && ((property.minimum !== undefined && value < property.minimum) || (property.maximum !== undefined && value > property.maximum))) errors[key] = `${key} is outside the allowed range`;
        if (property.enum && !property.enum.some((allowed) => JSON.stringify(allowed) === JSON.stringify(value))) errors[key] = `${key} must use an allowed value`;
        data[key] = value;
    }
    for (const key of required) {
        if (!Object.prototype.hasOwnProperty.call(data, key) && !errors[key]) errors[key] = `${key} is required`;
    }
    return { valid: Object.keys(errors).length === 0, data, errors };
}
