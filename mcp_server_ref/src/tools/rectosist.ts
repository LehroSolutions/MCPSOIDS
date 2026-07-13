import { z } from 'zod';

export const RectosistToolSchema = z.object({
  operation: z.enum(['check_health', 'get_dashboard_summary']),
  token: z.string().optional(),
});

export type RectosistToolParams = z.infer<typeof RectosistToolSchema>;

const RECTOSIST_URL = process.env.RECTOSIST_URL || 'http://localhost:3002/api/v1';

export async function handleRectosist(params: any): Promise<string> {
  const validated = RectosistToolSchema.parse(params);

  if (validated.operation === 'check_health') {
    const response = await fetch(`${RECTOSIST_URL}/health`);
    if (!response.ok) throw new Error(`Rectosist Health Check Failed: ${response.status}`);
    return await response.text();
  }

  if (validated.operation === 'get_dashboard_summary') {
    if (!validated.token) {
      // TODO: Implement login flow or use robust dev token
      return 'Auth Token required for dashboard summary. Please login first.';
    }
    const response = await fetch(`${RECTOSIST_URL}/dashboard/summary`, {
      headers: {
        Authorization: `Bearer ${validated.token}`,
      },
    });
    if (!response.ok) throw new Error(`Access Denied or Failed: ${response.status}`);
    return await response.text();
  }

  return 'Operation not implemented';
}

export const RECTOSIST_TOOL_DEFINITION = {
  name: 'business_intelligence',
  description:
    'Connects to RECTOSIST (Business Intelligence) to retrieve analytics and dashboard metrics.',
  inputSchema: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['check_health', 'get_dashboard_summary'],
      },
      token: { type: 'string', description: 'JWT Bearer token for authenticated requests' },
    },
    required: ['operation'],
  },
};
