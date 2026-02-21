/**
 * System Tray Module
 *
 * Creates and manages the system tray icon and its context menu.
 * Provides controls for starting/stopping the Crewly backend,
 * opening the dashboard, and quitting the app.
 *
 * @module desktop/main/tray
 */

import { Tray, Menu, shell, app, type BrowserWindow } from 'electron';
import * as path from 'path';
import type { ProcessManager } from './process-manager';

/** Singleton tray instance */
let tray: Tray | null = null;

/**
 * Creates the system tray icon and context menu.
 *
 * @param mainWindow - The main BrowserWindow (shown when "Open Dashboard" is clicked)
 * @param processManager - Manages the crewly backend process
 */
export function createTray(
  mainWindow: BrowserWindow | null,
  processManager: ProcessManager,
): void {
  const iconPath = path.join(__dirname, '..', '..', 'resources', 'tray-icon.png');
  tray = new Tray(iconPath);
  tray.setToolTip('Crewly');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: processManager.isRunning() ? '● Crewly Running' : '○ Crewly Stopped',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: 'Start Server',
      click: () => { processManager.start(); },
    },
    {
      label: 'Stop Server',
      click: () => { processManager.stop(); },
    },
    {
      label: 'Open Dashboard',
      click: () => {
        shell.openExternal('http://localhost:8788');
      },
    },
    { type: 'separator' },
    {
      label: 'Setup Wizard',
      click: () => { mainWindow?.show(); },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        processManager.stop();
        app.exit(0);
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow?.show();
  });
}
