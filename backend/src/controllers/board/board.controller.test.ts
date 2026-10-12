import type { Request, Response } from 'express';
import { createBoardHandlers } from './board.controller.js';
import type { BoardService } from '../../services/board/board.service.js';

function run(handler: (req: Request, res: Response) => unknown, params: Record<string, string> = {}): Promise<{ status: number; json: any }> {
	return new Promise((resolve) => {
		const out = { status: 200, json: undefined as unknown };
		const res = {
			status(code: number) { out.status = code; return this; },
			json(payload: unknown) { out.json = payload; resolve(out as { status: number; json: any }); return this; },
		} as unknown as Response;
		void Promise.resolve(handler({ params } as unknown as Request, res));
	});
}

describe('board controller', () => {
	it('returns the snapshot', async () => {
		const snapshot = { v: 1, teams: [] };
		const h = createBoardHandlers(() => ({ getSnapshot: async () => snapshot, timeline: () => [] }) as unknown as BoardService);
		expect(await run(h.getBoard)).toEqual({ status: 200, json: { success: true, data: snapshot } });
	});

	it('503 before the board is wired, 500 when the build fails', async () => {
		expect((await run(createBoardHandlers(() => null).getBoard)).status).toBe(503);
		const h = createBoardHandlers(() => ({ getSnapshot: async () => { throw new Error('boom'); } }) as unknown as BoardService);
		expect(await run(h.getBoard)).toEqual({ status: 500, json: { success: false, error: 'boom' } });
	});

	it('timeline validates the session name', async () => {
		const events = [{ session: 'a', at: 'x', type: 'coding', text: 'Edited a' }];
		const h = createBoardHandlers(() => ({ timeline: () => events }) as unknown as BoardService);
		expect((await run(h.getTimeline, { session: 'dev-1' })).json).toEqual({ success: true, data: events });
		expect((await run(h.getTimeline, { session: '../etc' })).status).toBe(400);
	});
});
