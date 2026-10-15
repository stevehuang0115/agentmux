// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadCrewlyEmbed, resetCrewlyEmbedForTests, type CrewlyEmbedGlobal } from './load.js';

const SCRIPT = 'https://apps.crewlyai.com/embed/v1/embed.js';

function scripts(): HTMLScriptElement[] {
  return Array.from(document.querySelectorAll('script[data-crewly-embed-sdk]'));
}

/** Make the injected script "load" and define the global. */
function fireLoad(api: CrewlyEmbedGlobal): void {
  (window as unknown as { CrewlyEmbed?: CrewlyEmbedGlobal }).CrewlyEmbed = api;
  for (const s of scripts()) s.dispatchEvent(new Event('load'));
}

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
  await new Promise((r) => setTimeout(r, 0));
}

function tokenResponses(...bodies: Array<string | 204 | 401>) {
  const fetchMock = vi.fn(async () => {
    const next = bodies.length > 1 ? bodies.shift()! : bodies[0]!;
    if (next === 204) return new Response(null, { status: 204 });
    if (next === 401) return new Response('no', { status: 401 });
    return new Response(next, { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  resetCrewlyEmbedForTests();
  document.head.innerHTML = '';
  delete (window as unknown as { CrewlyEmbed?: unknown }).CrewlyEmbed;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadCrewlyEmbed', () => {
  it('renders nothing on 204: no script, resolves null', async () => {
    const fetchMock = tokenResponses(204);
    await expect(loadCrewlyEmbed({ embedId: 'emb_1', tokenUrl: '/api/crewly/token' })).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('/api/crewly/token', { credentials: 'same-origin', cache: 'no-store' });
    expect(scripts()).toHaveLength(0);
  });

  it('renders nothing when the token route fails or the network is down', async () => {
    tokenResponses(401);
    await expect(loadCrewlyEmbed({ embedId: 'emb_1', tokenUrl: '/t' })).resolves.toBeNull();
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    await expect(loadCrewlyEmbed({ embedId: 'emb_1', tokenUrl: '/t' })).resolves.toBeNull();
    expect(scripts()).toHaveLength(0);
  });

  it('injects embed.js once and identifies with the prefetched, then fresh, tokens', async () => {
    const fetchMock = tokenResponses('tok-1', 'tok-2');
    const identify = vi.fn();
    const setContext = vi.fn();
    const p1 = loadCrewlyEmbed({ embedId: 'emb_1', tokenUrl: '/t', context: { page: 'home' } });
    const p2 = loadCrewlyEmbed({ embedId: 'emb_1', tokenUrl: '/t' });
    await flush();
    expect(scripts()).toHaveLength(1);
    const tag = scripts()[0]!;
    expect(tag.src).toBe(SCRIPT);
    expect(tag.async).toBe(true);
    expect(tag.getAttribute('data-embed')).toBe('emb_1');

    fireLoad({ identify, setContext });
    const [h1, h2] = await Promise.all([p1, p2]);
    expect(h1).not.toBeNull();
    expect(h1).toBe(h2);
    expect(identify).toHaveBeenCalledTimes(1);
    expect(setContext).toHaveBeenCalledWith({ page: 'home' });

    const fetcher = identify.mock.calls[0]![0] as () => Promise<string | null>;
    await expect(fetcher()).resolves.toBe('tok-1');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(fetcher()).resolves.toBe('tok-2');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // A later call reuses the loaded panel.
    await loadCrewlyEmbed({ embedId: 'emb_1', tokenUrl: '/t' });
    expect(scripts()).toHaveLength(1);
    expect(identify).toHaveBeenCalledTimes(1);
  });

  it('the refresh fetcher returns null once the user loses access', async () => {
    tokenResponses('tok-1', 204);
    const identify = vi.fn();
    const p = loadCrewlyEmbed({ embedId: 'emb_2', tokenUrl: '/t' });
    await flush();
    fireLoad({ identify });
    await p;
    const fetcher = identify.mock.calls[0]![0] as () => Promise<string | null>;
    await fetcher();
    await expect(fetcher()).resolves.toBeNull();
  });

  it('honours scriptUrl, and retries after a 204 once the user is allowed', async () => {
    tokenResponses(204);
    await expect(loadCrewlyEmbed({ embedId: 'emb_3', tokenUrl: '/t', scriptUrl: 'http://localhost:9/e.js' })).resolves.toBeNull();
    tokenResponses('tok');
    const p = loadCrewlyEmbed({ embedId: 'emb_3', tokenUrl: '/t', scriptUrl: 'http://localhost:9/e.js' });
    await flush();
    expect(scripts()[0]!.src).toBe('http://localhost:9/e.js');
    fireLoad({ identify: vi.fn() });
    await expect(p).resolves.not.toBeNull();
  });

  it('rejects when the script fails to load, and removes the tag', async () => {
    tokenResponses('tok');
    const p = loadCrewlyEmbed({ embedId: 'emb_4', tokenUrl: '/t' });
    await flush();
    scripts()[0]!.dispatchEvent(new Event('error'));
    await expect(p).rejects.toThrow(/failed to load/);
    expect(scripts()).toHaveLength(0);
  });

  it('rejects when the script defines no CrewlyEmbed', async () => {
    tokenResponses('tok');
    const p = loadCrewlyEmbed({ embedId: 'emb_5', tokenUrl: '/t' });
    await flush();
    for (const s of scripts()) s.dispatchEvent(new Event('load'));
    await expect(p).rejects.toThrow(/did not define/);
  });

  it('reuses a tag injected by another copy of the SDK', async () => {
    tokenResponses('tok');
    const tag = document.createElement('script');
    tag.src = SCRIPT;
    tag.setAttribute('data-embed', 'emb_7');
    tag.setAttribute('data-crewly-embed-sdk', '');
    document.head.appendChild(tag);
    const identify = vi.fn();
    const p = loadCrewlyEmbed({ embedId: 'emb_7', tokenUrl: '/t' });
    await flush();
    expect(scripts()).toHaveLength(1);
    fireLoad({ identify });
    await expect(p).resolves.not.toBeNull();
    expect(identify).toHaveBeenCalledTimes(1);
  });

  it('uses an already-present global without injecting', async () => {
    tokenResponses('tok');
    const identify = vi.fn();
    (window as unknown as { CrewlyEmbed?: CrewlyEmbedGlobal }).CrewlyEmbed = { identify };
    await expect(loadCrewlyEmbed({ embedId: 'emb_6', tokenUrl: '/t' })).resolves.not.toBeNull();
    expect(scripts()).toHaveLength(0);
    expect(identify).toHaveBeenCalledTimes(1);
  });
});
