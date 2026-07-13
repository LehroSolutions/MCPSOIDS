import { z } from 'zod';

export const EchoToolSchema = z.object({
  message: z.string(),
  delay_ms: z.number().optional().default(0),
});

export type EchoToolParams = z.infer<typeof EchoToolSchema>;

export async function handleEcho(params: any): Promise<string> {
  const validated = EchoToolSchema.parse(params);

  if (validated.delay_ms > 0) {
    await new Promise((resolve) => setTimeout(resolve, validated.delay_ms));
  }

  return validated.message;
}

export const ECHO_TOOL_DEFINITION = {
  name: '__echo',
  description: 'Internal compliance tool. Returns the input message after an optional delay.',
  inputSchema: {
    type: 'object',
    properties: {
      message: { type: 'string' },
      delay_ms: { type: 'number', description: 'Simulate latency' },
    },
    required: ['message'],
  },
};
