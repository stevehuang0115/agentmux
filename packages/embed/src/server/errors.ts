/**
 * Error types thrown by the server half of the SDK.
 */

/** Machine-readable reasons a token was rejected. */
export type EmbedTokenErrorCode =
  | 'malformed'
  | 'bad_algorithm'
  | 'bad_signature'
  | 'bad_audience'
  | 'bad_issuer'
  | 'bad_claims'
  | 'expired'
  | 'not_yet_valid'
  | 'lifetime_too_long'
  | 'bad_scope'
  | 'bad_secret';

/**
 * Thrown when a JWT cannot be signed or fails verification.
 *
 * The `code` is safe to log; the message never contains the token or secret.
 */
export class EmbedTokenError extends Error {
  /** Why the token was rejected. */
  readonly code: EmbedTokenErrorCode;

  /**
   * Create a token error.
   *
   * @param code - Machine-readable reason
   * @param message - Human-readable detail (never include token material)
   */
  constructor(code: EmbedTokenErrorCode, message: string) {
    super(message);
    this.name = 'EmbedTokenError';
    this.code = code;
  }
}

/**
 * Throw from an ops tool handler to answer with a specific status and code
 * instead of a generic 500, e.g. `throw new OpsError(404, 'lesson_not_found')`.
 *
 * The `code` and `message` are sent to the agent, so keep them free of data
 * the asker may not see.
 */
export class OpsError extends Error {
  /** HTTP status sent to the agent. */
  readonly status: number;
  /** Short machine-readable error code. */
  readonly code: string;

  /**
   * Create an ops error.
   *
   * @param status - HTTP status (4xx for asker-facing refusals)
   * @param code - Short machine-readable code, e.g. `not_found`
   * @param message - Optional detail returned to the agent
   */
  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.name = 'OpsError';
    this.status = status;
    this.code = code;
  }
}
