import { z } from 'zod';

export const DebugStressToolSchema = z.object({
  mode: z.enum(['memory', 'cpu', 'latency']),
  duration_ms: z.number().min(100).max(60000),
  intensity: z.number().min(1).max(1000).optional().default(10),
});

export type DebugStressToolParams = z.infer<typeof DebugStressToolSchema>;

// Keep references to prevent GC
const memoryHogs: any[] = [];

export async function handleDebugStress(params: any) {
  const { mode, duration_ms, intensity } = DebugStressToolSchema.parse(params);

  if (mode === 'memory') {
    // Allocate memory to trigger HealthMonitor warnings
    // intensity = MB to allocate
    const buffer = Buffer.alloc(intensity * 1024 * 1024, 'x');
    memoryHogs.push(buffer);

    // Release after duration
    setTimeout(() => {
      const index = memoryHogs.indexOf(buffer);
      if (index > -1) memoryHogs.splice(index, 1);
      if (global.gc) global.gc(); // Try to force GC if exposed
    }, duration_ms);

    return `Allocated ${intensity}MB for ${duration_ms}ms`;
  }

  if (mode === 'cpu') {
    const start = Date.now();
    while (Date.now() - start < duration_ms) {
      Math.random() * Math.random();
    }
    return `Burned CPU for ${duration_ms}ms`;
  }

  if (mode === 'latency') {
    await new Promise((resolve) => setTimeout(resolve, duration_ms));
    return `Slept for ${duration_ms}ms`;
  }

  return 'Unknown mode';
}

export const DEBUG_STRESS_TOOL_DEFINITION = {
  name: '__debug_stress',
  description: 'Internal stress testing tool to verify Health Monitor and Janitor protocols.',
  inputSchema: {
    type: 'object',
    properties: {
      mode: { type: 'string', enum: ['memory', 'cpu', 'latency'] },
      duration_ms: { type: 'number' },
      intensity: { type: 'number', description: 'MB for memory, or iterations for CPU' },
    },
    required: ['mode', 'duration_ms'],
  },
};
