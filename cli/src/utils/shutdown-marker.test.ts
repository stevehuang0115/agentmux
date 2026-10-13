/**
 * Tests for the CLI side of the shutdown marker.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { writeShutdownMarker, clearShutdownMarker, hasShutdownMarker, shutdownMarkerPath, stopLegacySupervisor } from './shutdown-marker.js';

describe('shutdown marker (cli)', () => {
	let home: string;
	beforeEach(() => {
		home = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-shutdown-marker-'));
	});
	afterEach(() => fs.rmSync(home, { recursive: true, force: true }));

	it('uses the same path as the backend and the supervisor script', () => {
		expect(shutdownMarkerPath(home)).toBe(path.join(home, 'run', 'shutdown-requested'));
	});

	it('sees and clears the marker', () => {
		fs.mkdirSync(path.join(home, 'run'));
		fs.writeFileSync(shutdownMarkerPath(home), '{}');
		expect(hasShutdownMarker(home)).toBe(true);
		clearShutdownMarker(home);
		expect(hasShutdownMarker(home)).toBe(false);
		clearShutdownMarker(home);
	});

	it('writes the marker (creating run/) and reports who asked', () => {
		expect(writeShutdownMarker(home)).toBe(true);
		expect(hasShutdownMarker(home)).toBe(true);
		expect(JSON.parse(fs.readFileSync(shutdownMarkerPath(home), 'utf-8')).by).toBe('crewly stop');
	});

	it('does not throw when the marker cannot be written', () => {
		fs.writeFileSync(path.join(home, 'run'), 'a file where the directory should be');
		expect(writeShutdownMarker(home)).toBe(false);
	});

	describe('stopLegacySupervisor', () => {
		it('stops an old crewly-start wrapper that is the parent', () => {
			const kill = jest.fn();
			expect(stopLegacySupervisor(4321, { commandOf: () => '/bin/bash /Users/me/.crewly/crewly-start.command', kill })).toBe(true);
			expect(kill).toHaveBeenCalledWith(4321, 'SIGTERM');
		});

		it('leaves any other parent alone (shell, systemd, launchd, pm2)', () => {
			const kill = jest.fn();
			expect(stopLegacySupervisor(4321, { commandOf: () => '-zsh', kill })).toBe(false);
			expect(stopLegacySupervisor(1, { commandOf: () => 'crewly-start', kill })).toBe(false);
			expect(kill).not.toHaveBeenCalled();
		});

		it('never throws when the parent cannot be inspected', () => {
			expect(stopLegacySupervisor(4321, { commandOf: () => { throw new Error('no ps'); } })).toBe(false);
		});
	});
});
