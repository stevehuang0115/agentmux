/**
 * macOS Notarization Script
 *
 * Used by electron-builder's afterSign hook to notarize the app
 * for distribution outside the Mac App Store.
 *
 * Requires the following environment variables:
 * - APPLE_ID: Apple Developer account email
 * - APPLE_ID_PASSWORD: App-specific password
 * - APPLE_TEAM_ID: Apple Developer Team ID
 *
 * @module desktop/scripts/notarize
 */

import { notarize } from '@electron/notarize';

/**
 * Notarizes the macOS application after signing.
 *
 * @param context - electron-builder afterSign context
 */
export async function afterSign(context: {
  electronPlatformName: string;
  appOutDir: string;
}): Promise<void> {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const appId = 'com.crewly.desktop';
  const appPath = `${context.appOutDir}/Crewly.app`;

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_ID_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (!appleId || !appleIdPassword || !teamId) {
    console.warn('Skipping notarization: missing APPLE_ID, APPLE_ID_PASSWORD, or APPLE_TEAM_ID');
    return;
  }

  await notarize({
    appPath,
    appleId,
    appleIdPassword,
    teamId,
  });
}
