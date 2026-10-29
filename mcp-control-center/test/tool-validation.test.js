import { expect, test } from 'bun:test';
import { validateArgs } from '../src/lib/tool-validation';

const tool = { inputSchema: { required: ['message'], properties: { message: { type: 'string', maxLength: 5 }, delay: { type: 'integer', minimum: 0, maximum: 50, default: 0 }, mode: { type: 'string', enum: ['safe'] } } } };

test('coerces numeric form fields and applies defaults without eval', () => {
    expect(validateArgs(tool, { message: 'hello', delay: '12' }).data.delay).toBe(12);
    expect(validateArgs(tool, { message: 'hello' }).data.delay).toBe(0);
});

test('reports required fields, length, integer bounds, and enumerated values', () => {
    expect(validateArgs(tool, {}).errors.message).toBe('message is required');
    for (const delay of ['NaN', '-1', '51', '1.5']) expect(validateArgs(tool, { message: 'ok', delay }).valid).toBe(false);
    expect(validateArgs(tool, { message: 'too long' }).valid).toBe(false);
    expect(validateArgs(tool, { message: 'ok', mode: 'unsafe' }).valid).toBe(false);
});
