/**
 * Browser loader for the Crewly side panel.
 *
 * Fetches the host's identity token first; only when the host answers with
 * a token does it inject Cloud's `embed.js` and hand it a token fetcher. A
 * 204 (user not allowed, or embed not configured) renders nothing at all.
 */
import { EMBED_CONSTANTS } from '../constants.js';

/** JSON context shown to the agent as untrusted page context (≤ 2 KB). */
export type EmbedContext = Record<string, unknown>;

/** Options for {@link loadCrewlyEmbed}. */
export interface LoadCrewlyEmbedOptions {
  /** The embed id (`emb_…`). Public. */
  embedId: string;
  /** Same-origin URL of the host's token route, e.g. `/api/crewly/token`. */
  tokenUrl: string;
  /** Optional page context, e.g. `{ page: 'course', courseId: 'c-42' }`. */
  context?: EmbedContext;
  /** Override the loader script URL (staging, local Cloud). */
  scriptUrl?: string;
}

/** Control over a loaded panel. */
export interface CrewlyEmbedHandle {
  /**
   * Replace the page context the agent sees.
   *
   * @param context - New context object
   */
  setContext(context: EmbedContext): void;
}

/** The global `embed.js` defines. */
export interface CrewlyEmbedGlobal {
  identify(fetchToken: () => Promise<string | null>): void;
  setContext?(context: EmbedContext): void;
}

const inflight = new Map<string, Promise<CrewlyEmbedHandle | null>>();
const scripts = new Map<string, Promise<void>>();

/**
 * Read the loader global, if the script has defined it.
 *
 * @returns The global, or undefined
 */
function getGlobal(): CrewlyEmbedGlobal | undefined {
  const value = (window as unknown as Record<string, unknown>)[EMBED_CONSTANTS.CLIENT.GLOBAL_NAME];
  return value && typeof (value as CrewlyEmbedGlobal).identify === 'function' ? (value as CrewlyEmbedGlobal) : undefined;
}

/**
 * Fetch the identity token from the host's token route.
 *
 * @param tokenUrl - The host's token route
 * @returns The token, or null when the route answers 204, an error, or nothing
 */
async function fetchToken(tokenUrl: string): Promise<string | null> {
  try {
    const res = await fetch(tokenUrl, { credentials: 'same-origin', cache: 'no-store' });
    if (res.status === 204 || !res.ok) return null;
    const text = (await res.text()).trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

/**
 * Inject the loader script once per (script URL, embed id) and wait for it.
 *
 * @param src - Script URL
 * @param embedId - Embed id for `data-embed`
 * @returns Resolves when the script has loaded
 */
function injectScript(src: string, embedId: string): Promise<void> {
  const key = `${src}\n${embedId}`;
  const existing = scripts.get(key);
  if (existing) return existing;
  const promise = new Promise<void>((resolve, reject) => {
    const marker = EMBED_CONSTANTS.CLIENT.SCRIPT_MARKER_ATTRIBUTE;
    // Another copy of this module (e.g. the React bundle) may have injected
    // the tag already; wait for that one instead of adding a second.
    const present = Array.from(document.querySelectorAll<HTMLScriptElement>(`script[${marker}]`)).find(
      (el) => el.src === src && el.getAttribute('data-embed') === embedId,
    );
    if (present) {
      present.addEventListener('load', () => resolve(), { once: true });
      present.addEventListener('error', () => reject(new Error(`Crewly embed script failed to load: ${src}`)), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.setAttribute('data-embed', embedId);
    script.setAttribute(marker, '');
    script.addEventListener('load', () => resolve(), { once: true });
    script.addEventListener(
      'error',
      () => {
        scripts.delete(key);
        script.remove();
        reject(new Error(`Crewly embed script failed to load: ${src}`));
      },
      { once: true },
    );
    document.head.appendChild(script);
  });
  scripts.set(key, promise);
  return promise;
}

/**
 * Load the Crewly side panel for the signed-in user.
 *
 * 1. Fetches `tokenUrl`. On 204 (or any non-OK answer) it stops and renders
 *    nothing: no script, no launcher.
 * 2. Injects `embed.js` once (repeat calls reuse it).
 * 3. Calls `CrewlyEmbed.identify` with a fetcher that hands over the token it
 *    already has, then fetches a fresh one each time the panel asks (before
 *    expiry).
 * 4. Applies `context` when given.
 *
 * Safe to call during server rendering: it resolves null without `window`.
 *
 * @param options - Embed id, token route, optional context and script URL
 * @returns A handle, or null when nothing was rendered
 * @throws Error when the script fails to load or defines no `CrewlyEmbed`
 *
 * @example
 * ```typescript
 * await loadCrewlyEmbed({ embedId: 'emb_abc', tokenUrl: '/api/crewly/token' });
 * ```
 */
export function loadCrewlyEmbed(options: LoadCrewlyEmbedOptions): Promise<CrewlyEmbedHandle | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return Promise.resolve(null);
  const src = options.scriptUrl ?? EMBED_CONSTANTS.CLIENT.DEFAULT_SCRIPT_URL;
  const key = `${src}\n${options.embedId}\n${options.tokenUrl}`;
  const pending = inflight.get(key);
  if (pending) {
    return pending.then((handle) => {
      if (handle && options.context) handle.setContext(options.context);
      return handle;
    });
  }

  const promise = (async (): Promise<CrewlyEmbedHandle | null> => {
    const first = await fetchToken(options.tokenUrl);
    if (first === null) return null;

    if (!getGlobal()) await injectScript(src, options.embedId);
    const api = getGlobal();
    if (!api) throw new Error('Crewly embed script loaded but did not define CrewlyEmbed');

    let prefetched: string | null = first;
    api.identify(async () => {
      if (prefetched !== null) {
        const token = prefetched;
        prefetched = null;
        return token;
      }
      return fetchToken(options.tokenUrl);
    });
    const handle: CrewlyEmbedHandle = {
      setContext(context) {
        getGlobal()?.setContext?.(context);
      },
    };
    if (options.context) handle.setContext(options.context);
    return handle;
  })();

  inflight.set(key, promise);
  // Only a successful load is remembered; a 204 or failure may succeed later
  // (the user signs in, or switches to an allowed role).
  promise.then(
    (handle) => {
      if (!handle) inflight.delete(key);
    },
    () => inflight.delete(key),
  );
  return promise;
}

/**
 * Forget loaded state. For tests only.
 */
export function resetCrewlyEmbedForTests(): void {
  inflight.clear();
  scripts.clear();
}
