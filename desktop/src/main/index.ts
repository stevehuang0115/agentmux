/**
 * Electron Main Process Entry
 *
 * Creates the setup wizard window on first launch. On subsequent launches,
 * minimises to the system tray and auto-starts the Crewly backend.
 *
 * @module desktop/main
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { createTray } from './tray';
import { registerInstallerHandlers } from './installer';
import { ProcessManager } from './process-manager';

/** The main browser window (setup wizard) */
let mainWindow: BrowserWindow | null = null;

/** Shared process manager for start/stop of crewly backend */
const processManager = new ProcessManager();

/**
 * Creates the setup wizard BrowserWindow.
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    resizable: false,
    title: 'Crewly Setup',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In development, load the Vite dev server; in production, load the built HTML
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  }

  mainWindow.on('close', (event) => {
    // Minimise to tray instead of closing
    event.preventDefault();
    mainWindow?.hide();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray(mainWindow, processManager);
  registerInstallerHandlers();

  app.on('activate', () => {
    if (mainWindow === null) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  // Keep running in tray on macOS
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  processManager.stop();
});

// IPC: show window from tray
ipcMain.on('show-window', () => {
  mainWindow?.show();
});
