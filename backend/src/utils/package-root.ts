import path from 'path';
import { readFileSync, existsSync } from 'fs';

/**
 * Finds the Crewly package root by walking up from the given directory,
 * looking for a package.json with `"name": "crewly"`.
 *
 * This works correctly in both development mode (where source lives at backend/src/)
 * and compiled/npm-installed mode (where code lives at dist/backend/backend/src/).
 * The naive `path.resolve(__dirname, '../..')` approach breaks in compiled mode
 * because the directory depth differs.
 *
 * @param startDir - Directory to start searching from (typically the caller's __dirname).
 * @returns The absolute path to the package root directory.
 * @throws Error if no matching package.json is found after reaching the filesystem root.
 */
export function findPackageRoot(startDir: string): string {
	let current = path.resolve(startDir);

	while (true) {
		const pkgPath = path.join(current, 'package.json');
		if (existsSync(pkgPath)) {
			try {
				const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
				if (pkg.name === 'crewly') {
					return current;
				}
			} catch {
				// Malformed package.json — keep searching
			}
		}

		const parent = path.dirname(current);
		if (parent === current) {
			throw new Error(
				'Could not find Crewly package root (no package.json with name "crewly" found in any parent directory)'
			);
		}
		current = parent;
	}
}
