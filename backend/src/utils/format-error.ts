/**
 * Format an unknown error value into a string message.
 *
 * @param error - The error value (could be Error, string, or anything)
 * @returns A string error message
 */
export function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
