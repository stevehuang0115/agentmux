// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const setContext = vi.fn();
const load = vi.fn();

vi.mock('../client/load.js', () => ({
  loadCrewlyEmbed: (...args: unknown[]) => load(...args),
}));

const { CrewlyEmbed } = await import('./CrewlyEmbed.js');

afterEach(() => {
  cleanup();
  load.mockReset();
  setContext.mockReset();
});

describe('<CrewlyEmbed>', () => {
  it('renders nothing and loads the panel with its props', async () => {
    load.mockResolvedValue({ setContext });
    const { container } = render(<CrewlyEmbed embedId="emb_1" tokenUrl="/api/crewly/token" context={{ page: 'home' }} />);
    expect(container.innerHTML).toBe('');
    await act(async () => {});
    expect(load).toHaveBeenCalledWith({ embedId: 'emb_1', tokenUrl: '/api/crewly/token', scriptUrl: undefined, context: { page: 'home' } });
  });

  it('forwards context changes without reloading', async () => {
    load.mockResolvedValue({ setContext });
    const { rerender } = render(<CrewlyEmbed embedId="emb_1" tokenUrl="/t" context={{ page: 'a' }} />);
    await act(async () => {});
    rerender(<CrewlyEmbed embedId="emb_1" tokenUrl="/t" context={{ page: 'b' }} />);
    await act(async () => {});
    expect(load).toHaveBeenCalledTimes(1);
    expect(setContext).toHaveBeenLastCalledWith({ page: 'b' });
  });

  it('stays empty on 204 (loader resolves null)', async () => {
    load.mockResolvedValue(null);
    const { container } = render(<CrewlyEmbed embedId="emb_1" tokenUrl="/t" context={{ page: 'a' }} />);
    await act(async () => {});
    expect(container.innerHTML).toBe('');
    expect(setContext).not.toHaveBeenCalled();
  });

  it('reports a loader failure through onError', async () => {
    const onError = vi.fn();
    load.mockRejectedValue(new Error('script failed'));
    render(<CrewlyEmbed embedId="emb_1" tokenUrl="/t" onError={onError} />);
    await act(async () => {});
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});
