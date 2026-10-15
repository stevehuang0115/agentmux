/**
 * Contract constants shared by the server and client halves of the SDK.
 *
 * These values mirror the Cloud contract in
 * `specs/2026-10-15-embedded-agent.md` (P1a). Changing one here without the
 * Cloud side changing too breaks the chain, so treat them as protocol.
 */
export const EMBED_CONSTANTS = {
  JWT: {
    /** The only signing algorithm accepted or produced. */
    ALG: 'HS256',
    TYP: 'JWT',
    /** Identity tokens (host -> Cloud) live at most 10 minutes. */
    IDENTITY_TTL_SECONDS: 600,
    /** Host tokens (Cloud -> host ops API) are minted for 300 s. */
    HOST_TOKEN_TTL_SECONDS: 300,
    /** Upper bound on `exp - iat` accepted for a host token. */
    HOST_TOKEN_MAX_LIFETIME_SECONDS: 300,
    /** Clock skew tolerated when checking `exp` and a future `iat`. */
    DEFAULT_CLOCK_TOLERANCE_SECONDS: 30,
    /** Prefix of a host token's `aud`: `host:<embedId>`. */
    HOST_AUDIENCE_PREFIX: 'host:',
    /** The issuer Cloud puts on host tokens. */
    HOST_ISSUER: 'crewly',
    /** The only scope in P1: act for the conversation's own asker. */
    SCOPE_SELF: 'self',
  },
  OPS: {
    /** Default per-user budget of write / irreversible calls per UTC day. */
    DEFAULT_WRITES_PER_DAY: 5,
    /** Request bodies above this are refused with 413. */
    DEFAULT_MAX_BODY_BYTES: 64 * 1024,
    /** Strings without an explicit `maxLength` are capped here. */
    DEFAULT_STRING_MAX_LENGTH: 2000,
    DAY_MS: 24 * 60 * 60 * 1000,
  },
  CLIENT: {
    /** Production loader script served by the Cloud apps service. */
    DEFAULT_SCRIPT_URL: 'https://apps.crewlyai.com/embed/v1/embed.js',
    /** Marker attribute on the script tag the SDK injects. */
    SCRIPT_MARKER_ATTRIBUTE: 'data-crewly-embed-sdk',
    /** Global the loader script defines. */
    GLOBAL_NAME: 'CrewlyEmbed',
  },
} as const;
