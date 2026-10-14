import { isDestructiveGitGuardEnabled, prepareDestructiveGitGuard } from './destructive-git-guard.service.js';
import { buildControlPlaneSettings, resolveControlPlanePaths } from './control-plane-guard.service.js';

describe('destructive-git-guard service', () => {
	it('is on by default and off only with the kill switch', () => {
		expect(isDestructiveGitGuardEnabled({})).toBe(true);
		expect(isDestructiveGitGuardEnabled({ CREWLY_DESTRUCTIVE_GIT_GUARD: '1' })).toBe(true);
		expect(isDestructiveGitGuardEnabled({ CREWLY_DESTRUCTIVE_GIT_GUARD: '0' })).toBe(false);
	});

	it('builds a node command for the hook script on Bash', () => {
		const g = prepareDestructiveGitGuard('/opt/crewly', {});
		expect(g?.matcher).toBe('Bash');
		expect(g?.hookCommand).toContain("'/opt/crewly/config/hooks/destructive-git-guard/guard.mjs'");
	});

	it('returns null when disabled', () => {
		expect(prepareDestructiveGitGuard('/opt/crewly', { CREWLY_DESTRUCTIVE_GIT_GUARD: '0' })).toBeNull();
	});

	it('adds a PreToolUse group to the Claude settings only when given', () => {
		const paths = resolveControlPlanePaths({ crewlyHome: '/h', installRoot: '/i' }, []);
		const without = buildControlPlaneSettings(paths, 'bash hook.sh paths');
		const guard = prepareDestructiveGitGuard('/i', {});
		const withGuard = buildControlPlaneSettings(paths, 'bash hook.sh paths', undefined, undefined, undefined, null, guard);
		expect(withGuard.hooks.PreToolUse).toHaveLength(without.hooks.PreToolUse.length + 1);
		expect(withGuard.hooks.PreToolUse.at(-1)?.hooks[0].command).toBe(guard?.hookCommand);
	});
});
