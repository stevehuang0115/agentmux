/**
 * A small validator for the params an ops tool declares.
 *
 * Deliberately tiny (no zod): four types, `required`, and bounds. Params are
 * read from the query string, and — for methods with a body — from the
 * top-level fields of a JSON object body. Query values are coerced from text;
 * body values must already have the right JSON type.
 */
import { EMBED_CONSTANTS } from '../constants.js';

/** Fields every param declaration may carry. */
interface BaseParamSpec {
  /** Shown to the agent in the manifest. */
  description?: string;
  /** When true, a call without this param is refused with 400. */
  required?: boolean;
}

/** A text param. */
export interface StringParamSpec extends BaseParamSpec {
  type: 'string';
  /** Longest accepted value. Default 2000. */
  maxLength?: number;
}

/** A numeric param. */
export interface NumberParamSpec extends BaseParamSpec {
  type: 'number';
  min?: number;
  max?: number;
  /** Refuse fractional values. */
  integer?: boolean;
}

/** A true/false param; query accepts `true|false|1|0`. */
export interface BooleanParamSpec extends BaseParamSpec {
  type: 'boolean';
}

/** One of a fixed list of strings. */
export interface EnumParamSpec extends BaseParamSpec {
  type: 'enum';
  values: readonly string[];
}

/** Any single param declaration. */
export type ParamSpec = StringParamSpec | NumberParamSpec | BooleanParamSpec | EnumParamSpec;

/** A tool's params: name → declaration. */
export type ParamsSpec = Readonly<Record<string, ParamSpec>>;

/** The runtime value type of one declaration. */
export type ParamValue<S extends ParamSpec> = S extends { type: 'string' }
  ? string
  : S extends { type: 'number' }
    ? number
    : S extends { type: 'boolean' }
      ? boolean
      : S extends { type: 'enum'; values: readonly (infer V)[] }
        ? V
        : never;

type RequiredKeys<P extends ParamsSpec> = { [K in keyof P]: P[K] extends { required: true } ? K : never }[keyof P];
type OptionalKeys<P extends ParamsSpec> = Exclude<keyof P, RequiredKeys<P>>;

/**
 * The validated params object a handler receives: required params are
 * present, optional ones may be missing.
 */
export type InferParams<P extends ParamsSpec> = { [K in RequiredKeys<P>]: ParamValue<P[K]> } & {
  [K in OptionalKeys<P>]?: ParamValue<P[K]>;
};

/** Where params are read from. */
export interface ParamSources {
  /** The request's query string. */
  query: URLSearchParams;
  /** The parsed JSON body, if the method has one. */
  body?: unknown;
}

/** Result of {@link validateParams}. */
export type ParamsResult =
  | { ok: true; params: Record<string, string | number | boolean> }
  | { ok: false; errors: string[] };

const NUMBER_TEXT = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;
const TRUE_TEXT = new Set(['true', '1']);
const FALSE_TEXT = new Set(['false', '0']);

/**
 * Check a param declaration is well formed. Used by `defineOpsTool` so a bad
 * declaration fails at startup instead of on the first call.
 *
 * @param name - Param name
 * @param spec - Its declaration
 * @throws TypeError on an unknown type, an empty enum or inverted bounds
 */
export function assertParamSpec(name: string, spec: ParamSpec): void {
  switch (spec.type) {
    case 'string':
      if (spec.maxLength !== undefined && (!Number.isInteger(spec.maxLength) || spec.maxLength < 0)) {
        throw new TypeError(`Param "${name}": maxLength must be a non-negative integer`);
      }
      return;
    case 'number':
      if (spec.min !== undefined && spec.max !== undefined && spec.min > spec.max) {
        throw new TypeError(`Param "${name}": min is greater than max`);
      }
      return;
    case 'boolean':
      return;
    case 'enum':
      if (!Array.isArray(spec.values) || spec.values.length === 0 || !spec.values.every((v) => typeof v === 'string')) {
        throw new TypeError(`Param "${name}": enum values must be a non-empty list of strings`);
      }
      return;
    default:
      throw new TypeError(`Param "${name}": unknown type "${(spec as { type: unknown }).type}"`);
  }
}

/**
 * Validate and coerce one raw value against its declaration.
 *
 * @param name - Param name, for error text
 * @param spec - Its declaration
 * @param raw - The raw value
 * @param fromQuery - True when `raw` is query text (coerce) rather than JSON
 * @returns The typed value, or an error message
 */
function coerce(
  name: string,
  spec: ParamSpec,
  raw: unknown,
  fromQuery: boolean,
): { value: string | number | boolean } | { error: string } {
  switch (spec.type) {
    case 'string': {
      if (typeof raw !== 'string') return { error: `${name} must be a string` };
      const max = spec.maxLength ?? EMBED_CONSTANTS.OPS.DEFAULT_STRING_MAX_LENGTH;
      if (raw.length > max) return { error: `${name} must be at most ${max} characters` };
      return { value: raw };
    }
    case 'number': {
      let value: number;
      if (fromQuery) {
        if (typeof raw !== 'string' || !NUMBER_TEXT.test(raw)) return { error: `${name} must be a number` };
        value = Number(raw);
      } else {
        if (typeof raw !== 'number') return { error: `${name} must be a number` };
        value = raw;
      }
      if (!Number.isFinite(value)) return { error: `${name} must be a finite number` };
      if (spec.integer && !Number.isInteger(value)) return { error: `${name} must be an integer` };
      if (spec.min !== undefined && value < spec.min) return { error: `${name} must be at least ${spec.min}` };
      if (spec.max !== undefined && value > spec.max) return { error: `${name} must be at most ${spec.max}` };
      return { value };
    }
    case 'boolean': {
      if (fromQuery) {
        if (typeof raw === 'string' && TRUE_TEXT.has(raw)) return { value: true };
        if (typeof raw === 'string' && FALSE_TEXT.has(raw)) return { value: false };
        return { error: `${name} must be true or false` };
      }
      if (typeof raw !== 'boolean') return { error: `${name} must be a boolean` };
      return { value: raw };
    }
    case 'enum': {
      if (typeof raw !== 'string' || !spec.values.includes(raw)) {
        return { error: `${name} must be one of: ${spec.values.join(', ')}` };
      }
      return { value: raw };
    }
    default:
      return { error: `${name} has an unknown type` };
  }
}

/**
 * Validate a call's params against a tool's declaration.
 *
 * Rules: query keys the tool does not declare are refused (so a typo is an
 * error, not a silently ignored filter); a key repeated in the query is
 * refused; a declared param may come from the query or, when absent there,
 * from a JSON object body; body fields not declared are left for the
 * handler's `body`.
 *
 * @param spec - The tool's params declaration
 * @param sources - Query string and optional parsed body
 * @returns The typed params, or every error found
 *
 * @example
 * ```typescript
 * const r = validateParams({ lessonId: { type: 'string', required: true } }, { query: url.searchParams });
 * if (!r.ok) return new Response(JSON.stringify({ errors: r.errors }), { status: 400 });
 * ```
 */
export function validateParams(spec: ParamsSpec, sources: ParamSources): ParamsResult {
  const errors: string[] = [];
  const params: Record<string, string | number | boolean> = {};
  const declared = Object.keys(spec);

  for (const key of new Set(sources.query.keys())) {
    if (!Object.prototype.hasOwnProperty.call(spec, key)) errors.push(`unknown param: ${key}`);
    else if (sources.query.getAll(key).length > 1) errors.push(`${key} is given more than once`);
  }

  const body =
    sources.body !== null && typeof sources.body === 'object' && !Array.isArray(sources.body)
      ? (sources.body as Record<string, unknown>)
      : undefined;

  for (const name of declared) {
    const paramSpec = spec[name] as ParamSpec;
    let raw: unknown;
    let fromQuery = false;
    if (sources.query.has(name)) {
      raw = sources.query.get(name);
      fromQuery = true;
    } else if (body && Object.prototype.hasOwnProperty.call(body, name) && body[name] !== undefined && body[name] !== null) {
      raw = body[name];
    } else {
      if (paramSpec.required) errors.push(`${name} is required`);
      continue;
    }
    const result = coerce(name, paramSpec, raw, fromQuery);
    if ('error' in result) errors.push(result.error);
    else params[name] = result.value;
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, params };
}
