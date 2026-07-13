import { z } from 'zod';

export const LehroAiToolSchema = z.object({
    message: z.string().optional().describe('The chat message or query for the AI'),
    skill: z.string().optional().describe('Name of the skill to execute (e.g., "analytics_query")'),
    skillParams: z.record(z.any()).optional().describe('Parameters for the skill execution'),
    model: z.string().optional().default('lehro-v1'),
}).refine(data => data.message || data.skill, {
    message: "Either 'message' (for chat) or 'skill' (for tool execution) must be provided."
});

export type LehroAiToolParams = z.infer<typeof LehroAiToolSchema>;

const AI_BACKEND_URL = process.env.AI_BACKEND_URL || 'http://localhost:8001';

interface ChatCompletionResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

interface SkillResponse {
    skill: string;
    status: string;
    data: any;
}

export async function handleLehroChat(params: any): Promise<string> {
    const validated = LehroAiToolSchema.parse(params);

    try {
        // Mode 1: Execute Skill
        if (validated.skill) {
            const skillResponse = await fetch(`${AI_BACKEND_URL}/v1/skills/${validated.skill}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    skill: validated.skill,
                    parameters: validated.skillParams || {}
                })
            });

            if (!skillResponse.ok) {
                throw new Error(`Skill execution failed: ${skillResponse.status}`);
            }

            const skillResult = (await skillResponse.json()) as SkillResponse;
            return JSON.stringify(skillResult, null, 2);
        }

        // Mode 2: Chat Completion
        const response = await fetch(`${AI_BACKEND_URL}/v1/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: validated.message }],
                model: validated.model
            })
        });

        if (!response.ok) {
            throw new Error(`AI Backend returned ${response.status}: ${await response.text()}`);
        }

        const data = (await response.json()) as ChatCompletionResponse;
        return data.choices?.[0]?.message?.content || "No response content from model.";

    } catch (error: any) {
        throw new Error(`Failed to call Lehro AI: ${error.message}`);
    }
}

export const LEHRO_CHAT_TOOL_DEFINITION = {
    name: "ask_lehro_ai",
    description: "Connects to Lehro Solutions A.I to ask questions or execute specialized skills (analytics, docs, etc).",
    inputSchema: {
        type: "object",
        properties: {
            message: { type: "string", description: "The query or prompt to send to the AI." },
            skill: { type: "string", description: "Optional: Name of a specific skill to execute (e.g. 'analytics_query')" },
            skillParams: { type: "object", description: "Optional: Parameters for the skill" },
            model: { type: "string", description: "Optional model ID" }
        }
    }
};
