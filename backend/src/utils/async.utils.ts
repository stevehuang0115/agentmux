/**
 * Async Utilities
 *
 * Shared async helper functions used across backend services.
 *
 * @module async-utils
 */

/**
 * Creates a promise that resolves after a specified delay.
 *
 * This is the standard delay utility used throughout the backend
 * for timing-sensitive operations like terminal interactions.
 *
 * @param ms - Milliseconds to delay
 * @returns Promise that resolves after the delay
 *
 * @example
 * ```typescript
 * // Wait 500ms before next operation
 * await delay(500);
 *
 * // Use with configured constants
 * await delay(SESSION_COMMAND_DELAYS.MESSAGE_DELAY);
 * ```
 */
export function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with a timeout, returning a default value if timeout expires.
 *
 * @param fn - Async function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param defaultValue - Value to return if timeout expires
 * @returns Promise resolving to function result or default value
 *
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   () => fetchData(),
 *   5000,
 *   null
 * );
 * ```
 */
export async function withTimeout<T>(
	fn: () => Promise<T>,
	timeoutMs: number,
	defaultValue: T
): Promise<T> {
	return Promise.race([
		fn(),
		new Promise<T>((resolve) => setTimeout(() => resolve(defaultValue), timeoutMs)),
	]);
}

/**
 * Execute a function with a timeout, throwing an error if timeout expires.
 *
 * @param fn - Async function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Error message if timeout expires
 * @returns Promise resolving to function result
 * @throws Error if timeout expires
 *
 * @example
 * ```typescript
 * try {
 *   const result = await withTimeoutError(
 *     () => fetchData(),
 *     5000,
 *     'Operation timed out'
 *   );
 * } catch (error) {
 *   console.error(error.message);
 * }
 * ```
 */
export async function withTimeoutError<T>(
	fn: () => Promise<T>,
	timeoutMs: number,
	errorMessage: string
): Promise<T> {
	return Promise.race([
		fn(),
		new Promise<T>((_, reject) =>
			setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
		),
	]);
}
