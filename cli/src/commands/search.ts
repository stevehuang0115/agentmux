/**
 * CLI Search Command
 *
 * Searches and lists items from the Crewly marketplace. Shows a formatted
 * table of matching items with name, type, version, and description.
 *
 * @module cli/commands/search
 */

import chalk from 'chalk';
import { fetchRegistry, loadManifest, type MarketplaceItem } from '../utils/marketplace.js';

interface SearchOptions {
  type?: string;
}

/**
 * Searches the marketplace for items matching a query.
 *
 * When no query is provided, lists all items. Supports filtering by type
 * with the --type flag (skill, model, role).
 *
 * @param query - Optional free-text search query
 * @param options - Command options (--type)
 */
export async function searchCommand(query?: string, options?: SearchOptions): Promise<void> {
  try {
    const registry = await fetchRegistry();
    let items = registry.items;

    // Filter by type
    if (options?.type) {
      items = items.filter((i) => i.type === options.type);
    }

    // Filter by query
    if (query) {
      const q = query.toLowerCase();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.tags.some((t) => t.toLowerCase().includes(q)) ||
          i.id.toLowerCase().includes(q)
      );
    }

    if (items.length === 0) {
      if (query) {
        console.log(chalk.yellow(`No items matching "${query}".`));
      } else {
        console.log(chalk.yellow('No items in the marketplace.'));
      }
      return;
    }

    // Load manifest to show install status
    const manifest = await loadManifest();
    const installedIds = new Set(manifest.items.map((r) => r.id));

    // Print header
    console.log('');
    console.log(chalk.bold('Crewly Marketplace'));
    if (query) {
      console.log(chalk.gray(`Results for "${query}"`));
    }
    console.log('');

    // Print items
    const maxNameLen = Math.max(...items.map((i) => i.name.length), 4);
    const header = `  ${'Name'.padEnd(maxNameLen)}  ${'Type'.padEnd(6)}  ${'Version'.padEnd(8)}  ${'Status'.padEnd(11)}  Description`;
    console.log(chalk.gray(header));
    console.log(chalk.gray('  ' + '─'.repeat(header.length - 2)));

    for (const item of items) {
      const status = installedIds.has(item.id)
        ? chalk.green('installed')
        : chalk.gray('available');
      const nameCol = item.name.padEnd(maxNameLen);
      const typeCol = item.type.padEnd(6);
      const versionCol = item.version.padEnd(8);
      const statusCol = (installedIds.has(item.id) ? 'installed' : 'available').padEnd(11);
      const desc = item.description.length > 50
        ? item.description.substring(0, 47) + '...'
        : item.description;

      const statusFormatted = installedIds.has(item.id)
        ? chalk.green(statusCol)
        : chalk.gray(statusCol);

      console.log(`  ${chalk.white(nameCol)}  ${chalk.cyan(typeCol)}  ${chalk.gray(versionCol)}  ${statusFormatted}  ${chalk.gray(desc)}`);
    }

    console.log('');
    console.log(chalk.gray(`${items.length} item(s) found. Install with: crewly install <id>`));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(chalk.red(`Search failed: ${msg}`));
    process.exit(1);
  }
}
