/**
 * `@crewly/embed/server` — the host server side of the Crewly embedded agent.
 *
 * - {@link signIdentityToken}: the JWT your token route returns for the
 *   logged-in user.
 * - {@link createOpsHandler} + {@link defineOpsTool}: the asker-scoped API the
 *   agent calls, verified with {@link verifyHostToken}.
 * - {@link toExpress}: mount the handler in Express or plain Node http.
 */
export { signIdentityToken, verifyIdentityToken, signHostToken, verifyHostToken } from './tokens.js';
export type {
  EmbedIdentityUser,
  SignIdentityTokenOptions,
  IdentityTokenClaims,
  VerifyTokenOptions,
  SignHostTokenOptions,
  HostTokenGrant,
} from './tokens.js';
export { defineOpsTool, toManifestTool } from './ops-tool.js';
export type {
  OpsTool,
  AnyOpsTool,
  OpsToolContext,
  ErasedOpsToolContext,
  OpsRisk,
  OpsMethod,
  ManifestTool,
  ManifestParam,
} from './ops-tool.js';
export { createOpsHandler } from './ops-handler.js';
export type { CreateOpsHandlerOptions, OpsAuditEvent, OpsManifest, OpsOutcome, OpsRequestHandler } from './ops-handler.js';
export { createMemoryLimitStore } from './limits.js';
export type { OpsLimits, OpsLimitStore } from './limits.js';
export { validateParams } from './params.js';
export type {
  ParamSpec,
  ParamsSpec,
  StringParamSpec,
  NumberParamSpec,
  BooleanParamSpec,
  EnumParamSpec,
  InferParams,
  ParamValue,
} from './params.js';
export { toExpress, toWebRequest, sendWebResponse } from './express.js';
export type { NodeLikeRequest, NodeLikeResponse, NodeMiddleware, ToExpressOptions } from './express.js';
export { EmbedTokenError, OpsError } from './errors.js';
export type { EmbedTokenErrorCode } from './errors.js';
