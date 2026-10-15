import { createExternalRouter } from './external.routes.js';

interface Layer { route?: { path: string; methods: Record<string, boolean>; stack: unknown[] } }

describe('external routes', () => {
	const router = createExternalRouter();
	const find = (method: string, path: string) => (router.stack as Layer[]).find((l) => l.route?.path === path && l.route.methods[method]);

	it('registers replies, host-api and the owner embed routes, each behind a caller check', () => {
		for (const [m, p] of [
			['post', '/replies'],
			['post', '/host-api'],
			['get', '/embeds'],
			['put', '/embeds/:embedId'],
			['delete', '/embeds/:embedId'],
		]) {
			const layer = find(m, p);
			expect(layer).toBeDefined();
			expect(layer?.route?.stack.length).toBe(2);
		}
	});
});
