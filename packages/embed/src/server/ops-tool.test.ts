import { describe, expect, expectTypeOf, it } from 'vitest';
import { defineOpsTool, toManifestTool } from './ops-tool.js';

const base = {
  name: 'my-classes',
  method: 'GET',
  path: '/my-classes',
  risk: 'read',
  description: 'Upcoming classes.',
  handler: () => [],
} as const;

describe('defineOpsTool', () => {
  it('returns a frozen copy and keeps param types', () => {
    const tool = defineOpsTool({
      ...base,
      params: { from: { type: 'string' }, lessonId: { type: 'string', required: true } },
      handler: ({ params }) => {
        expectTypeOf(params.lessonId).toEqualTypeOf<string>();
        expectTypeOf(params.from).toEqualTypeOf<string | undefined>();
        return params.lessonId;
      },
    });
    expect(Object.isFrozen(tool)).toBe(true);
    expect(tool.name).toBe('my-classes');
  });

  it('types user when given', () => {
    defineOpsTool<{ id: string }>({
      ...base,
      handler: ({ user }) => {
        expectTypeOf(user).toEqualTypeOf<{ id: string }>();
        return user.id;
      },
    });
  });

  it('refuses malformed declarations', () => {
    expect(() => defineOpsTool({ ...base, name: 'bad name' })).toThrow(/name/);
    expect(() => defineOpsTool({ ...base, method: 'TRACE' as never })).toThrow(/method/);
    expect(() => defineOpsTool({ ...base, path: 'my-classes' })).toThrow(/path/);
    expect(() => defineOpsTool({ ...base, path: '/' })).toThrow(/path/);
    expect(() => defineOpsTool({ ...base, path: '/a/' })).toThrow(/path/);
    expect(() => defineOpsTool({ ...base, path: '/a?b=1' })).toThrow(/path/);
    expect(() => defineOpsTool({ ...base, risk: 'scary' as never })).toThrow(/risk/);
    expect(() => defineOpsTool({ ...base, description: ' ' })).toThrow(/description/);
    expect(() => defineOpsTool({ ...base, handler: undefined as never })).toThrow(/handler/);
    expect(() => defineOpsTool({ ...base, params: { k: { type: 'enum', values: [] } } })).toThrow(/enum/);
  });
});

describe('toManifestTool', () => {
  it('lists every field but the handler, with explicit required flags', () => {
    const tool = defineOpsTool({
      ...base,
      params: { from: { type: 'string', maxLength: 10, description: 'ISO date' }, id: { type: 'number', required: true } },
    });
    expect(toManifestTool(tool)).toEqual({
      name: 'my-classes',
      method: 'GET',
      path: '/my-classes',
      risk: 'read',
      description: 'Upcoming classes.',
      params: {
        from: { type: 'string', maxLength: 10, description: 'ISO date', required: false },
        id: { type: 'number', required: true },
      },
    });
  });
});
