/**
 * Ops tools: the host's own functions, exposed to the Crewly agent as a
 * small, discoverable, asker-scoped HTTP API (#1325).
 */
import { assertParamSpec, type InferParams, type ParamSpec, type ParamsSpec } from './params.js';

/** How much harm a call can do; drives limits and how the agent treats it. */
export type OpsRisk = 'read' | 'write' | 'irreversible';

/** HTTP methods a tool may use. */
export type OpsMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** What a tool handler receives. */
export interface OpsToolContext<U, P extends ParamsSpec> {
  /** The asker, as returned by the host's `resolveUser(sub)`. */
  user: U;
  /** Declared params, validated and typed. */
  params: InferParams<P>;
  /** The parsed JSON body (methods with a body), else undefined. */
  body: unknown;
  /** The verified `sub` the agent is acting for. */
  sub: string;
  /** The original request, for anything else the handler needs. */
  request: Request;
}

/** A tool as declared by the host. */
export interface OpsTool<U = unknown, P extends ParamsSpec = ParamsSpec> {
  /** Stable tool name shown to the agent, e.g. `my-classes`. */
  name: string;
  method: OpsMethod;
  /** Path below the ops base, e.g. `/my-classes`. */
  path: string;
  risk: OpsRisk;
  /** One or two sentences the agent reads to decide when to call it. */
  description: string;
  /** Declared params; anything else in the query is refused. */
  params?: P;
  /**
   * Run the tool as the asker. Return a JSON-serialisable value (sent with
   * 200), `undefined` (204), or a `Response` for full control. Throw
   * `OpsError` for a specific refusal.
   *
   * @param context - The asker, params and body
   */
  handler(context: OpsToolContext<U, P>): unknown;
}

/**
 * The context type a stored tool is called with. `params: never` lets a
 * list hold tools with different params while still checking that each
 * tool's `user` type accepts the host's resolved user.
 */
export interface ErasedOpsToolContext<U> {
  user: U;
  params: never;
  body: unknown;
  sub: string;
  request: Request;
}

/**
 * Any defined tool whose handler accepts users of type `U`, whatever its
 * params. This is what `createOpsHandler` takes.
 */
export type AnyOpsTool<U = never> = Omit<OpsTool<U>, 'handler' | 'params'> & {
  params?: ParamsSpec;
  /** See {@link OpsTool.handler}. */
  handler(context: ErasedOpsToolContext<U>): unknown;
};

/** A param as listed in the manifest. */
export type ManifestParam = ParamSpec & { required: boolean };

/** One tool as listed in the manifest. */
export interface ManifestTool {
  name: string;
  method: OpsMethod;
  path: string;
  risk: OpsRisk;
  description: string;
  params: Record<string, ManifestParam>;
}

const TOOL_NAME = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const TOOL_PATH = /^(?:\/[A-Za-z0-9._~-]+)+$/;
const METHODS: readonly OpsMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const RISKS: readonly OpsRisk[] = ['read', 'write', 'irreversible'];

/**
 * Declare an ops tool. Validates the declaration up front so a mistake fails
 * at startup, and keeps the params' types for the handler.
 *
 * Pass the user type as the first type argument to type `user`
 * (`defineOpsTool<PortalUser>({...})`); params are then typed loosely. Leave
 * the type arguments off to get exact params types with `user: unknown`.
 *
 * @param tool - Name, method, path, risk, description, params and handler
 * @returns The same tool, frozen
 * @throws TypeError when a field is malformed
 *
 * @example
 * ```typescript
 * const myClasses = defineOpsTool({
 *   name: 'my-classes', method: 'GET', path: '/my-classes', risk: 'read',
 *   description: "The asker's upcoming classes.",
 *   params: { from: { type: 'string', maxLength: 10 } },
 *   handler: ({ user, params }) => listClasses(user as PortalUser, params.from),
 * });
 * ```
 */
export function defineOpsTool<U = unknown, const P extends ParamsSpec = ParamsSpec>(tool: OpsTool<U, P>): OpsTool<U, P> {
  if (!tool || typeof tool !== 'object') throw new TypeError('defineOpsTool needs a tool object');
  if (typeof tool.name !== 'string' || !TOOL_NAME.test(tool.name)) {
    throw new TypeError(`Tool name "${String(tool.name)}" must be 1-64 letters, digits, - or _`);
  }
  if (!METHODS.includes(tool.method)) throw new TypeError(`Tool "${tool.name}": unsupported method ${String(tool.method)}`);
  if (typeof tool.path !== 'string' || !TOOL_PATH.test(tool.path)) {
    throw new TypeError(`Tool "${tool.name}": path must look like /segment[/segment], got "${String(tool.path)}"`);
  }
  if (!RISKS.includes(tool.risk)) throw new TypeError(`Tool "${tool.name}": risk must be read, write or irreversible`);
  if (typeof tool.description !== 'string' || tool.description.trim().length === 0) {
    throw new TypeError(`Tool "${tool.name}": description is required`);
  }
  if (typeof tool.handler !== 'function') throw new TypeError(`Tool "${tool.name}": handler must be a function`);
  for (const [name, spec] of Object.entries(tool.params ?? {})) assertParamSpec(name, spec);
  return Object.freeze({ ...tool });
}

/**
 * Describe a tool for the manifest the agent reads. Handlers are not
 * included; every param gets an explicit `required` flag.
 *
 * @param tool - A defined tool
 * @returns Its manifest entry
 */
export function toManifestTool(tool: AnyOpsTool): ManifestTool {
  const params: Record<string, ManifestParam> = {};
  for (const [name, spec] of Object.entries(tool.params ?? {})) {
    params[name] = { ...spec, required: spec.required === true };
  }
  return {
    name: tool.name,
    method: tool.method,
    path: tool.path,
    risk: tool.risk,
    description: tool.description,
    params,
  };
}
