/**
 * setVisibleInterval — a drop-in `setInterval` for polling that does nothing
 * while the tab is hidden.
 *
 * A dashboard left open in a background tab should not keep fetching and
 * re-rendering on every tick. The returned handle is a normal interval id, so
 * `clearInterval` still cancels it. Polling resumes on the first tick after the
 * tab becomes visible again (callers that need an immediate refresh on return
 * should add their own `visibilitychange` handler).
 *
 * @module utils/visible-interval
 */

/** Whether the document is currently hidden (false outside a browser). */
export function isDocumentHidden(): boolean {
  return typeof document !== 'undefined' && document.hidden === true;
}

/**
 * Like `setInterval`, but skips ticks while `document.hidden`.
 *
 * @param callback - Work to run each visible tick
 * @param ms - Interval in milliseconds
 * @returns The interval id (cancel with `clearInterval`)
 */
export function setVisibleInterval(
  callback: () => void,
  ms: number,
): ReturnType<typeof setInterval> {
  return setInterval(() => {
    if (isDocumentHidden()) return;
    callback();
  }, ms);
}
