/**
 * React wrapper around {@link loadCrewlyEmbed}. Renders nothing itself: the
 * launcher and panel are injected by Crewly's `embed.js`, and only when the
 * host's token route returns a token.
 */
import { useEffect, useRef } from 'react';
import { loadCrewlyEmbed, type CrewlyEmbedHandle, type EmbedContext } from '../client/load.js';

/** Props for {@link CrewlyEmbed}. */
export interface CrewlyEmbedProps {
  /** The embed id (`emb_…`). */
  embedId: string;
  /** Same-origin URL of the host's token route. */
  tokenUrl: string;
  /** Optional page context; updates are forwarded to the panel. */
  context?: EmbedContext;
  /** Override the loader script URL (staging, local Cloud). */
  scriptUrl?: string;
  /** Called when the loader script fails; the panel then stays hidden. */
  onError?: (error: unknown) => void;
}

/**
 * Mount the Crewly side panel for the signed-in user. Put it once in the
 * signed-in layout; it renders `null`.
 *
 * @param props - Embed id, token route, optional context, script URL and error callback
 * @returns null
 *
 * @example
 * ```tsx
 * <CrewlyEmbed embedId={process.env.NEXT_PUBLIC_CREWLY_EMBED_ID!} tokenUrl="/api/crewly/token" />
 * ```
 */
export function CrewlyEmbed({ embedId, tokenUrl, context, scriptUrl, onError }: CrewlyEmbedProps): null {
  const handleRef = useRef<CrewlyEmbedHandle | null>(null);
  const contextRef = useRef<EmbedContext | undefined>(context);
  const onErrorRef = useRef(onError);
  contextRef.current = context;
  onErrorRef.current = onError;
  const contextKey = context === undefined ? '' : JSON.stringify(context);

  useEffect(() => {
    let active = true;
    loadCrewlyEmbed({ embedId, tokenUrl, scriptUrl, context: contextRef.current }).then(
      (handle) => {
        if (!active) return;
        handleRef.current = handle;
        // Context may have changed while the panel was loading.
        if (handle && contextRef.current) handle.setContext(contextRef.current);
      },
      (error: unknown) => {
        if (active) onErrorRef.current?.(error);
      },
    );
    return () => {
      active = false;
      handleRef.current = null;
    };
  }, [embedId, tokenUrl, scriptUrl]);

  useEffect(() => {
    if (handleRef.current && contextRef.current) handleRef.current.setContext(contextRef.current);
  }, [contextKey]);

  return null;
}
