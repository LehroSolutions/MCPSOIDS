export type PolicyMode = 'enforce' | 'dry-run';

export type PolicyEffect = 'allow' | 'deny';

export type PolicyDecision = {
    allowed: boolean;
    effect: PolicyEffect;
    enforced: boolean;
    mode: PolicyMode;
    policyId: string;
    reason: string;
    matchedPattern?: string;
};

export type PolicyRequest = {
    action: 'tools/call';
    agentId: string;
    toolName: string;
};

type CompiledPattern = {
    raw: string;
    regex: RegExp;
};

export type PolicyEngineOptions = {
    mode?: PolicyMode;
    allowTools?: string[];
    denyTools?: string[];
};

const DEFAULT_ALLOW_TOOLS = ['*'];

function compileGlob(pattern: string): CompiledPattern {
    const escaped = pattern
        .trim()
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');

    return {
        raw: pattern,
        regex: new RegExp(`^${escaped}$`),
    };
}

function normalizePatterns(patterns: string[] | undefined, fallback: string[]): CompiledPattern[] {
    const usable = (patterns ?? [])
        .map((pattern) => pattern.trim())
        .filter(Boolean);

    return (usable.length > 0 ? usable : fallback).map(compileGlob);
}

export function splitPolicyPatterns(raw: string | undefined): string[] | undefined {
    if (!raw) return undefined;
    return raw.split(',').map((item) => item.trim()).filter(Boolean);
}

export class PolicyEngine {
    private readonly mode: PolicyMode;
    private readonly allowTools: CompiledPattern[];
    private readonly denyTools: CompiledPattern[];

    constructor(options: PolicyEngineOptions = {}) {
        this.mode = options.mode ?? 'enforce';
        this.allowTools = normalizePatterns(options.allowTools, DEFAULT_ALLOW_TOOLS);
        this.denyTools = normalizePatterns(options.denyTools, []);
    }

    public evaluate(request: PolicyRequest): PolicyDecision {
        const deniedBy = this.denyTools.find((pattern) => pattern.regex.test(request.toolName));
        if (deniedBy) {
            const enforced = this.mode === 'enforce';
            return {
                allowed: !enforced,
                effect: 'deny',
                enforced,
                mode: this.mode,
                policyId: 'oss-tool-deny-list',
                matchedPattern: deniedBy.raw,
                reason: enforced
                    ? `Tool ${request.toolName} denied by policy pattern ${deniedBy.raw}`
                    : `Tool ${request.toolName} would be denied by policy pattern ${deniedBy.raw}`,
            };
        }

        const allowedBy = this.allowTools.find((pattern) => pattern.regex.test(request.toolName));
        if (allowedBy) {
            return {
                allowed: true,
                effect: 'allow',
                enforced: true,
                mode: this.mode,
                policyId: 'oss-default-tool-allow',
                matchedPattern: allowedBy.raw,
                reason: `Tool ${request.toolName} allowed by policy pattern ${allowedBy.raw}`,
            };
        }

        const enforced = this.mode === 'enforce';
        return {
            allowed: !enforced,
            effect: 'deny',
            enforced,
            mode: this.mode,
            policyId: 'oss-tool-allow-list',
            reason: enforced
                ? `Tool ${request.toolName} has no matching allow policy`
                : `Tool ${request.toolName} would be denied because it has no matching allow policy`,
        };
    }
}
