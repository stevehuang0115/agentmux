/**
 * Lazy loader for SlackOrchestratorBridge.
 *
 * Breaks the circular dependency:
 *   slack-orchestrator-bridge → orchestrator/index → safe-restart / self-improvement → slack-orchestrator-bridge
 *
 * Both safe-restart.service.ts and self-improvement.service.ts import from here
 * instead of duplicating the lazy-import boilerplate.
 */

let cachedGetBridge: typeof import('../slack/slack-orchestrator-bridge.js').getSlackOrchestratorBridge | null = null;

/**
 * Lazily imports and returns the SlackOrchestratorBridge singleton.
 * The first call triggers a dynamic import; subsequent calls use the cached reference.
 *
 * @returns The SlackOrchestratorBridge instance
 */
export async function getSlackBridgeLazy() {
	if (!cachedGetBridge) {
		try {
			const mod = await import('../slack/slack-orchestrator-bridge.js');
			cachedGetBridge = mod.getSlackOrchestratorBridge;
		} catch (error) {
			// Don't cache the failure so the next call can retry
			throw new Error(
				`Failed to load Slack bridge: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}
	return cachedGetBridge();
}
