/**
 * Error handling utilities for the Crewly frontend
 *
 * Provides consistent error handling patterns for non-critical operations
 * that should not crash the application but should still be logged.
 */

/**
 * Log levels for error handling
 */
export type LogLevel = 'debug' | 'warn' | 'error';

/**
 * Options for silent error handling
 */
export interface SilentErrorOptions {
  /** Context message to provide additional information */
  context?: string;
  /** Log level to use (default: 'debug') */
  level?: LogLevel;
  /** Whether to log in production (default: false) */
  logInProduction?: boolean;
}

/**
 * Determines if we're in development mode
 *
 * @returns True if running in development mode
 */
export const isDevelopment = (): boolean => {
  // Use Vite's import.meta.env which is typed in vite-env.d.ts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const env = (import.meta as any).env;
  return env?.DEV === true || env?.MODE === 'development';
};

/**
 * Logs an error for non-critical operations that should not crash the app
 *
 * Use this when an operation failure is acceptable (e.g., loading optional data,
 * avatar fetching, filter population) but you still want visibility during development.
 *
 * @param error - The error that occurred
 * @param options - Configuration options for error handling
 *
 * @example
 * ```typescript
 * try {
 *   await fetchOptionalData();
 * } catch (e) {
 *   logSilentError(e, { context: 'Loading optional data' });
 * }
 * ```
 */
export const logSilentError = (
  error: unknown,
  options: SilentErrorOptions = {}
): void => {
  const { context, level = 'debug', logInProduction = false } = options;

  // Only log in development unless explicitly requested
  if (!isDevelopment() && !logInProduction) {
    return;
  }

  const message = context
    ? `[Silent Error] ${context}`
    : '[Silent Error]';

  const errorMessage = error instanceof Error ? error.message : String(error);

  switch (level) {
    case 'error':
      console.error(message, errorMessage);
      break;
    case 'warn':
      console.warn(message, errorMessage);
      break;
    case 'debug':
    default:
      console.debug(message, errorMessage);
      break;
  }
};

/**
 * Wraps an async function to handle errors silently
 *
 * Returns undefined if the function throws, logging the error in development.
 * Useful for optional data fetching operations.
 *
 * @param fn - The async function to wrap
 * @param options - Configuration options for error handling
 * @returns The result of the function or undefined if it throws
 *
 * @example
 * ```typescript
 * const data = await withSilentError(
 *   () => fetchOptionalData(),
 *   { context: 'Fetching optional data' }
 * );
 * if (data) {
 *   // Use data
 * }
 * ```
 */
export const withSilentError = async <T>(
  fn: () => Promise<T>,
  options: SilentErrorOptions = {}
): Promise<T | undefined> => {
  try {
    return await fn();
  } catch (error) {
    logSilentError(error, options);
    return undefined;
  }
};

/**
 * Creates a handler for non-critical errors in useEffect or event handlers
 *
 * @param context - Context message for the error
 * @param options - Additional options
 * @returns An error handler function
 *
 * @example
 * ```typescript
 * const handleError = createSilentErrorHandler('Loading avatars');
 *
 * useEffect(() => {
 *   fetchAvatars().catch(handleError);
 * }, []);
 * ```
 */
export const createSilentErrorHandler = (
  context: string,
  options: Omit<SilentErrorOptions, 'context'> = {}
): ((error: unknown) => void) => {
  return (error: unknown) => {
    logSilentError(error, { ...options, context });
  };
};
