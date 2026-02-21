/**
 * Preload Script
 *
 * Exposes a safe IPC bridge to the renderer process via contextBridge.
 * The renderer can call window.crewly.* methods to invoke installer actions.
 *
 * @module desktop/preload
 */

import { contextBridge, ipcRenderer } from 'electron';

/**
 * API exposed to the renderer via window.crewly
 */
const api = {
  /** Check if Node.js is installed */
  checkNode: (): Promise<{ installed: boolean; version?: string }> =>
    ipcRenderer.invoke('check-node'),

  /** Check if Crewly CLI is installed */
  checkCrewly: (): Promise<{ installed: boolean; version?: string }> =>
    ipcRenderer.invoke('check-crewly'),

  /** Install Crewly CLI globally */
  installCrewly: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('install-crewly'),

  /** Check if a tool is installed (e.g. "claude", "gemini") */
  checkTool: (tool: string): Promise<{ installed: boolean; version?: string }> =>
    ipcRenderer.invoke('check-tool', tool),

  /** Install a tool via npm package name */
  installTool: (npmPackage: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('install-tool', npmPackage),

  /** Install all agent skills from marketplace */
  installSkills: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('install-skills'),
};

contextBridge.exposeInMainWorld('crewly', api);

/** Type declaration for the renderer */
export type CrewlyAPI = typeof api;
