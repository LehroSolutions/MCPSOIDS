import { describe, expect, test } from 'bun:test';
import {
  DEBUG_STRESS_DURATION_MAX_MS,
  DEBUG_STRESS_INTENSITY_MAX,
  DEBUG_STRESS_TOOL_DEFINITION,
  DebugStressToolSchema,
  handleDebugStress,
} from '../src/tools/debug';
import { resolveDebugToolsEnabled } from '../src/config';

type JsonSchemaProperty = {
  type?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
};

const properties = DEBUG_STRESS_TOOL_DEFINITION.inputSchema.properties as Record<
  string,
  JsonSchemaProperty
>;

// Highest intensity the zod schema still accepts, derived rather than assumed so
// the JSON Schema ceiling is compared against real validation behaviour.
function highestZodIntensityCeiling(): number {
  let ceiling = 0;
  for (let candidate = 1; candidate <= DEBUG_STRESS_INTENSITY_MAX + 1; candidate += 1) {
    if (
      DebugStressToolSchema.safeParse({ mode: 'memory', duration_ms: 100, intensity: candidate })
        .success
    ) {
      ceiling = candidate;
    }
  }
  return ceiling;
}

describe('debug tool opt-in gate', () => {
  test('is disabled under the default config, including a development NODE_ENV', () => {
    expect(
      resolveDebugToolsEnabled({ MCP_ENABLE_DEBUG_TOOLS: false, NODE_ENV: 'development' }),
    ).toBe(false);
    expect(
      resolveDebugToolsEnabled({ MCP_ENABLE_DEBUG_TOOLS: 'false', NODE_ENV: 'development' }),
    ).toBe(false);
    expect(resolveDebugToolsEnabled({ NODE_ENV: 'development' })).toBe(false);
    expect(resolveDebugToolsEnabled({})).toBe(false);
  });

  test('is enabled only for an explicit MCP_ENABLE_DEBUG_TOOLS true', () => {
    expect(resolveDebugToolsEnabled({ MCP_ENABLE_DEBUG_TOOLS: 'true' })).toBe(true);
    expect(resolveDebugToolsEnabled({ MCP_ENABLE_DEBUG_TOOLS: true })).toBe(true);
    expect(
      resolveDebugToolsEnabled({ MCP_ENABLE_DEBUG_TOOLS: 'true', NODE_ENV: 'production' }),
    ).toBe(true);
  });

  test('rejects near-miss truthy flag values', () => {
    expect(resolveDebugToolsEnabled({ MCP_ENABLE_DEBUG_TOOLS: '1' })).toBe(false);
    expect(resolveDebugToolsEnabled({ MCP_ENABLE_DEBUG_TOOLS: 'yes' })).toBe(false);
    expect(resolveDebugToolsEnabled({ MCP_ENABLE_DEBUG_TOOLS: 'TRUE' })).toBe(false);
    expect(resolveDebugToolsEnabled({ MCP_ENABLE_DEBUG_TOOLS: '' })).toBe(false);
  });
});

describe('__debug_stress input bounds', () => {
  test('rejects an intensity above the ceiling', () => {
    const tooMuch = DebugStressToolSchema.safeParse({
      mode: 'memory',
      duration_ms: 100,
      intensity: DEBUG_STRESS_INTENSITY_MAX + 1,
    });
    expect(tooMuch.success).toBe(false);
  });

  test('caps intensity at a diagnostics-safe allocation ceiling', () => {
    expect(DEBUG_STRESS_INTENSITY_MAX).toBe(256);
    expect(highestZodIntensityCeiling()).toBe(DEBUG_STRESS_INTENSITY_MAX);
  });

  test('the published JSON Schema ceiling agrees with the zod ceiling', () => {
    expect(properties.intensity.maximum).toBe(highestZodIntensityCeiling());
    expect(properties.intensity.minimum).toBe(1);
    expect(properties.duration_ms.maximum).toBe(DEBUG_STRESS_DURATION_MAX_MS);
  });

  test('the published JSON Schema keeps the tool surface and enum values', () => {
    expect(DEBUG_STRESS_TOOL_DEFINITION.name).toBe('__debug_stress');
    expect(properties.mode.enum).toEqual(['memory', 'cpu', 'latency']);
    expect(Object.keys(properties).sort()).toEqual(['duration_ms', 'intensity', 'mode']);
    expect(DEBUG_STRESS_TOOL_DEFINITION.inputSchema.required).toEqual(['mode', 'duration_ms']);
  });
});

describe('__debug_stress cpu mode yields to the event loop', () => {
  test('a short burn resolves without starving timers', async () => {
    let timerFired = false;
    let resolved = false;
    const timer = setTimeout(() => {
      timerFired = true;
    }, 0);

    const run = handleDebugStress({ mode: 'cpu', duration_ms: 250, intensity: 10 }).then(
      (message: string) => {
        resolved = true;
        return message;
      },
    );

    await run;
    clearTimeout(timer);
    expect(resolved).toBe(true);
    expect(timerFired).toBe(true);
  });

  test('a short burn keeps its documented duration semantics', async () => {
    const before = Date.now();
    const message = await handleDebugStress({ mode: 'cpu', duration_ms: 200, intensity: 10 });
    const elapsed = Date.now() - before;
    expect(message).toBe('Burned CPU for 200ms');
    expect(elapsed).toBeGreaterThanOrEqual(200);
  });
});
