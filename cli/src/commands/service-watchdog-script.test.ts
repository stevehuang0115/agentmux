/**
 * Runs the bash test harness of the launchd watchdog script
 * (config/service/crewly-watchdog.test.sh) as part of the jest suite.
 */

import { spawnSync } from 'child_process';
import * as path from 'path';

const HARNESS = path.resolve(__dirname, '../../../config/service/crewly-watchdog.test.sh');

describe('crewly-watchdog.sh (bash harness)', () => {
	it('passes all cases', () => {
		const result = spawnSync('bash', [HARNESS], { encoding: 'utf-8', timeout: 60_000 });
		expect(result.stdout + result.stderr).toContain('0 failed');
		expect(result.status).toBe(0);
	});
});
