/**
 * Installer Module
 *
 * Provides IPC handlers for checking and installing Node.js, Crewly,
 * AI coding tools, and agent skills. The renderer invokes these handlers
 * to drive the setup wizard progress UI.
 *
 * @module desktop/main/installer
 */

import { ipcMain } from 'electron';
import { execSync } from 'child_process';

/**
 * Result of a tool/dependency check.
 */
interface CheckResult {
  installed: boolean;
  version?: string;
}

/**
 * Checks whether a CLI command is available and returns its version.
 *
 * @param command - The command name (e.g. "node", "claude")
 * @param versionFlag - Flag to get version string (default: "--version")
 * @returns Check result with installed status and optional version
 */
function checkCommand(command: string, versionFlag = '--version'): CheckResult {
  try {
    const output = execSync(`${command} ${versionFlag}`, {
      stdio: 'pipe',
      timeout: 10000,
    }).toString().trim();
    const match = output.match(/\d+\.\d+[\w.-]*/);
    return { installed: true, version: match ? match[0] : output.split('\n')[0] };
  } catch {
    return { installed: false };
  }
}

/**
 * Registers all IPC handlers used by the renderer setup wizard.
 */
export function registerInstallerHandlers(): void {
  // Node.js
  ipcMain.handle('check-node', () => checkCommand('node'));

  // Crewly CLI
  ipcMain.handle('check-crewly', () => checkCommand('crewly'));

  ipcMain.handle('install-crewly', async () => {
    try {
      execSync('npm install -g crewly', { stdio: 'pipe', timeout: 120000 });
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // AI tools
  ipcMain.handle('check-tool', (_event, tool: string) => checkCommand(tool));

  ipcMain.handle('install-tool', async (_event, npmPackage: string) => {
    try {
      execSync(`npm install -g ${npmPackage}`, { stdio: 'pipe', timeout: 120000 });
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Skills — delegates to CLI
  ipcMain.handle('install-skills', async () => {
    try {
      execSync('crewly install --all', { stdio: 'pipe', timeout: 300000 });
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}
