/**
 * Tests for the crewly upgrade command
 *
 * @module cli/commands/upgrade.test
 */

// Mock chalk (ESM-only)
jest.mock('chalk', () => ({
	__esModule: true,
	default: new Proxy({}, {
		get: () => {
			const fn = (s: string) => s;
			return new Proxy(fn, { get: () => fn, apply: (_t, _this, args) => args[0] });
		},
	}),
}));

// Mock the version-check module
jest.mock('../utils/version-check.js', () => ({
	checkForUpdate: jest.fn(),
	printUpdateNotification: jest.fn(),
}));

// Mock child_process
jest.mock('child_process', () => ({
	spawn: jest.fn(),
}));

import { upgradeCommand } from './upgrade.js';
import { checkForUpdate, printUpdateNotification } from '../utils/version-check.js';
import { spawn } from 'child_process';

const mockedCheckForUpdate = checkForUpdate as jest.MockedFunction<typeof checkForUpdate>;
const mockedPrintUpdateNotification = printUpdateNotification as jest.MockedFunction<typeof printUpdateNotification>;
const mockedSpawn = spawn as jest.MockedFunction<typeof spawn>;

describe('upgradeCommand', () => {
	let consoleSpy: jest.SpyInstance;
	let consoleErrorSpy: jest.SpyInstance;

	beforeEach(() => {
		consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
		consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
		jest.clearAllMocks();
	});

	afterEach(() => {
		consoleSpy.mockRestore();
		consoleErrorSpy.mockRestore();
	});

	describe('with --check flag', () => {
		it('should print update notification when update is available', async () => {
			mockedCheckForUpdate.mockResolvedValue({
				currentVersion: '1.0.0',
				latestVersion: '2.0.0',
				updateAvailable: true,
			});

			await upgradeCommand({ check: true });

			expect(mockedCheckForUpdate).toHaveBeenCalled();
			expect(mockedPrintUpdateNotification).toHaveBeenCalledWith('1.0.0', '2.0.0');
		});

		it('should print up-to-date message when on latest version', async () => {
			mockedCheckForUpdate.mockResolvedValue({
				currentVersion: '1.0.0',
				latestVersion: '1.0.0',
				updateAvailable: false,
			});

			await upgradeCommand({ check: true });

			expect(mockedCheckForUpdate).toHaveBeenCalled();
			expect(mockedPrintUpdateNotification).not.toHaveBeenCalled();
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('latest version')
			);
		});

		it('should print warning when check fails', async () => {
			mockedCheckForUpdate.mockResolvedValue({
				currentVersion: '1.0.0',
				latestVersion: null,
				updateAvailable: false,
			});

			await upgradeCommand({ check: true });

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('Unable to check')
			);
		});
	});

	describe('without --check flag', () => {
		it('should spawn npm install -g crewly@latest', () => {
			const mockChild = {
				on: jest.fn(),
			};
			mockedSpawn.mockReturnValue(mockChild as any);

			upgradeCommand({});

			expect(mockedSpawn).toHaveBeenCalledWith(
				'npm',
				['install', '-g', 'crewly@latest'],
				expect.objectContaining({ stdio: 'inherit', shell: true })
			);
		});

		it('should log success on exit code 0', () => {
			const mockChild = {
				on: jest.fn(),
			};
			mockedSpawn.mockReturnValue(mockChild as any);

			upgradeCommand({});

			// Simulate successful exit
			const exitHandler = mockChild.on.mock.calls.find(
				(call: any[]) => call[0] === 'exit'
			)?.[1] as (code: number) => void;

			if (exitHandler) {
				exitHandler(0);
				expect(consoleSpy).toHaveBeenCalledWith(
					expect.stringContaining('upgraded successfully')
				);
			}
		});
	});
});
