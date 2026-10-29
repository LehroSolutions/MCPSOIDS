import { z } from 'zod';

export const DEBUG_STRESS_INTENSITY_MAX = 256;
export const DEBUG_STRESS_DURATION_MIN_MS = 100;
export const DEBUG_STRESS_DURATION_MAX_MS = 60000;

// Longest uninterrupted synchronous slice of cpu mode before yielding. Kept short
// so timers, transport requests and /metrics stay serviced during a long burn.
const CPU_SLICE_MS = 8;

export const DebugStressToolSchema = z.object({
  mode: z.enum(['memory', 'cpu', 'latency']),
  duration_ms: z.number().min(DEBUG_STRESS_DURATION_MIN_MS).max(DEBUG_STRESS_DURATION_MAX_MS),
  intensity: z.number().min(1).max(DEBUG_STRESS_INTENSITY_MAX).optional().default(10),
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
      const sliceEnd = Date.now() + CPU_SLICE_MS;
      do {
        Math.random() * Math.random();
      } while (Date.now() < sliceEnd);
      await new Promise((resolve) => setImmediate(resolve));
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
      duration_ms: {
        type: 'number',
        minimum: DEBUG_STRESS_DURATION_MIN_MS,
        maximum: DEBUG_STRESS_DURATION_MAX_MS,
      },
      intensity: {
        type: 'number',
        description: 'MB for memory, or iterations for CPU',
        minimum: 1,
        maximum: DEBUG_STRESS_INTENSITY_MAX,
      },
    },
    required: ['mode', 'duration_ms'],
  },
};
