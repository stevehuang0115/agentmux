import path from 'path';
import fs from 'fs';
import { findPackageRoot } from './package-root.js';

describe('findPackageRoot', () => {
	it('should find the package root from the utils directory', () => {
		const root = findPackageRoot(__dirname);
		const pkgPath = path.join(root, 'package.json');
		const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
		expect(pkg.name).toBe('crewly');
	});

	it('should find the package root from a deeply nested directory', () => {
		const deepDir = path.join(__dirname, '..', 'services', 'session', 'pty');
		const root = findPackageRoot(deepDir);
		const pkgPath = path.join(root, 'package.json');
		const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
		expect(pkg.name).toBe('crewly');
	});

	it('should find the package root when starting from the root itself', () => {
		const expectedRoot = findPackageRoot(__dirname);
		const root = findPackageRoot(expectedRoot);
		expect(root).toBe(expectedRoot);
	});

	it('should throw if no crewly package.json is found', () => {
		expect(() => findPackageRoot('/')).toThrow(
			'Could not find Crewly package root'
		);
	});
});
