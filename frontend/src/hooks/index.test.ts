/**
 * Hooks barrel export tests
 *
 * Ensures all hooks are properly exported from the hooks index.
 */

import { describe, it, expect } from 'vitest';
import * as hooks from './index';

describe('hooks barrel export', () => {
	it('should export useFactorySSE hook', () => {
		expect(hooks.useFactorySSE).toBeDefined();
		expect(typeof hooks.useFactorySSE).toBe('function');
	});
});
