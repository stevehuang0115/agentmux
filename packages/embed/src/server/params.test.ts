import { describe, expect, expectTypeOf, it } from 'vitest';
import { assertParamSpec, validateParams, type InferParams } from './params.js';

const q = (s: string) => new URLSearchParams(s);

describe('validateParams', () => {
  const spec = {
    lessonId: { type: 'string', required: true, maxLength: 8 },
    limit: { type: 'number', integer: true, min: 1, max: 50 },
    done: { type: 'boolean' },
    kind: { type: 'enum', values: ['open', 'closed'] },
  } as const;

  it('coerces query text to typed values', () => {
    expect(validateParams(spec, { query: q('lessonId=L1&limit=10&done=true&kind=open') })).toEqual({
      ok: true,
      params: { lessonId: 'L1', limit: 10, done: true, kind: 'open' },
    });
    expect(validateParams(spec, { query: q('lessonId=L1&done=0') })).toEqual({ ok: true, params: { lessonId: 'L1', done: false } });
  });

  it('reports a missing required param', () => {
    expect(validateParams(spec, { query: q('') })).toEqual({ ok: false, errors: ['lessonId is required'] });
  });

  it('enforces max length, number bounds, integer, boolean and enum', () => {
    const r = validateParams(spec, { query: q('lessonId=123456789&limit=0.5&done=yes&kind=maybe') });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toEqual([
        'lessonId must be at most 8 characters',
        'limit must be an integer',
        'done must be true or false',
        'kind must be one of: open, closed',
      ]);
    }
    const r2 = validateParams(spec, { query: q('lessonId=a&limit=99') });
    expect(r2).toEqual({ ok: false, errors: ['limit must be at most 50'] });
    expect(validateParams(spec, { query: q('lessonId=a&limit=abc') })).toEqual({ ok: false, errors: ['limit must be a number'] });
    expect(validateParams(spec, { query: q('lessonId=a&limit=') })).toEqual({ ok: false, errors: ['limit must be a number'] });
  });

  it('applies the default string cap', () => {
    const r = validateParams({ s: { type: 'string' } }, { query: q(`s=${'x'.repeat(2001)}`) });
    expect(r).toEqual({ ok: false, errors: ['s must be at most 2000 characters'] });
  });

  it('refuses unknown and repeated query keys', () => {
    expect(validateParams(spec, { query: q('lessonId=a&teacher=other') })).toEqual({ ok: false, errors: ['unknown param: teacher'] });
    expect(validateParams(spec, { query: q('lessonId=a&lessonId=b') })).toEqual({ ok: false, errors: ['lessonId is given more than once'] });
  });

  it('reads declared params from a JSON body with strict types', () => {
    const tickets = { title: { type: 'string', required: true, maxLength: 5 }, urgent: { type: 'boolean' } } as const;
    expect(validateParams(tickets, { query: q(''), body: { title: 'Fix', urgent: true, extra: 1 } })).toEqual({
      ok: true,
      params: { title: 'Fix', urgent: true },
    });
    expect(validateParams(tickets, { query: q(''), body: { title: 7, urgent: 'true' } })).toEqual({
      ok: false,
      errors: ['title must be a string', 'urgent must be a boolean'],
    });
    expect(validateParams(tickets, { query: q(''), body: ['x'] })).toEqual({ ok: false, errors: ['title is required'] });
    expect(validateParams({ n: { type: 'number' } }, { query: q(''), body: { n: '5' } })).toEqual({ ok: false, errors: ['n must be a number'] });
    expect(validateParams({ n: { type: 'number' } }, { query: q(''), body: { n: 5 } })).toEqual({ ok: true, params: { n: 5 } });
  });

  it('types the result from the declaration', () => {
    type P = InferParams<typeof spec>;
    expectTypeOf<P['lessonId']>().toEqualTypeOf<string>();
    expectTypeOf<P['kind']>().toEqualTypeOf<'open' | 'closed' | undefined>();
    expectTypeOf<P['limit']>().toEqualTypeOf<number | undefined>();
  });
});

describe('assertParamSpec', () => {
  it('accepts good declarations', () => {
    expect(() => assertParamSpec('a', { type: 'string', maxLength: 3 })).not.toThrow();
    expect(() => assertParamSpec('a', { type: 'boolean' })).not.toThrow();
  });

  it('refuses bad declarations', () => {
    expect(() => assertParamSpec('a', { type: 'enum', values: [] })).toThrow(TypeError);
    expect(() => assertParamSpec('a', { type: 'number', min: 5, max: 1 })).toThrow(TypeError);
    expect(() => assertParamSpec('a', { type: 'string', maxLength: -1 })).toThrow(TypeError);
    expect(() => assertParamSpec('a', { type: 'date' } as never)).toThrow(TypeError);
  });
});
