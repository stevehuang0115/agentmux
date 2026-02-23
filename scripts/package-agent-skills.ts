#!/usr/bin/env tsx
/**
 * Package Agent Skills for Marketplace
 *
 * Iterates config/skills/agent/marketplace/, reads skill.json metadata,
 * creates tar.gz archives, computes SHA-256 checksums, and generates item.json
 * files for each skill. Output goes to dist/marketplace-export/skills/.
 *
 * Run: npx tsx scripts/package-agent-skills.ts
 *
 * After running, copy dist/marketplace-export/skills/ to the marketing site's
 * content/marketplace/skills/ directory.
 */

import path from 'path';
import { readdir, readFile, mkdir, writeFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { createHash } from 'crypto';
import * as tar from 'tar';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const MARKETPLACE_SKILLS_DIR = path.join(PROJECT_ROOT, 'config', 'skills', 'agent', 'marketplace');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'dist', 'marketplace-export', 'skills');

interface SkillJson {
  id: string;
  name: string;
  description: string;
  category: string;
  version?: string;
  tags?: string[];
  skillType?: string;
  assignableRoles?: string[];
}

interface MarketplaceItemJson {
  id: string;
  type: 'skill';
  name: string;
  description: string;
  author: string;
  version: string;
  category: string;
  tags: string[];
  license: string;
  downloads: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
  assets: {
    archive: string;
    checksum: string;
    sizeBytes: number;
  };
  metadata: {
    skillType: string;
    assignableRoles: string[];
    sourceDir: string;
  };
}

/**
 * Main entry point — scans agent skills and packages each one.
 */
async function main(): Promise<void> {
  console.log('Packaging agent skills for marketplace...\n');

  if (!existsSync(MARKETPLACE_SKILLS_DIR)) {
    console.error(`Agent skills directory not found: ${MARKETPLACE_SKILLS_DIR}`);
    process.exit(1);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });

  const entries = await readdir(MARKETPLACE_SKILLS_DIR, { withFileTypes: true });
  const skillDirs = entries
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  let count = 0;

  for (const entry of skillDirs) {
    const skillDir = path.join(MARKETPLACE_SKILLS_DIR, entry.name);
    const skillJsonPath = path.join(skillDir, 'skill.json');

    if (!existsSync(skillJsonPath)) {
      console.log(`  SKIP ${entry.name} (no skill.json)`);
      continue;
    }

    const skillJson: SkillJson = JSON.parse(await readFile(skillJsonPath, 'utf-8'));
    const id = `skill-${entry.name}`;
    const version = skillJson.version || '1.0.0';
    const archiveName = `${id}-${version}.tar.gz`;

    // Create output directory
    const itemOutputDir = path.join(OUTPUT_DIR, id);
    await mkdir(itemOutputDir, { recursive: true });

    // Create tar.gz archive
    const archivePath = path.join(itemOutputDir, archiveName);
    await tar.c(
      {
        gzip: true,
        file: archivePath,
        cwd: MARKETPLACE_SKILLS_DIR,
        filter: (filePath: string) => {
          // Exclude .env files but allow .env.example
          const base = path.basename(filePath);
          if (base === '.env' || (base.startsWith('.env.') && base !== '.env.example')) {
            return false;
          }
          return true;
        },
      },
      [entry.name]
    );

    // Compute checksum and size
    const archiveData = await readFile(archivePath);
    const checksum = 'sha256:' + createHash('sha256').update(archiveData).digest('hex');
    const archiveStats = await stat(archivePath);

    // Generate item.json
    const now = new Date().toISOString();
    const itemJson: MarketplaceItemJson = {
      id,
      type: 'skill',
      name: skillJson.name,
      description: skillJson.description,
      author: 'Crewly Team',
      version,
      category: mapCategory(skillJson.category),
      tags: skillJson.tags || [],
      license: 'MIT',
      downloads: 0,
      rating: 5,
      createdAt: now,
      updatedAt: now,
      assets: {
        archive: `skills/${id}/${archiveName}`,
        checksum,
        sizeBytes: archiveStats.size,
      },
      metadata: {
        skillType: skillJson.skillType || 'claude-skill',
        assignableRoles: skillJson.assignableRoles || [],
        sourceDir: entry.name,
      },
    };

    await writeFile(
      path.join(itemOutputDir, 'item.json'),
      JSON.stringify(itemJson, null, 2) + '\n'
    );

    const sizeKb = (archiveStats.size / 1024).toFixed(1);
    console.log(`  ✓ ${skillJson.name.padEnd(25)} → ${archiveName} (${sizeKb} KB)`);
    count++;
  }

  console.log(`\nDone! ${count} skills packaged to ${OUTPUT_DIR}`);
  console.log('\nNext steps:');
  console.log('  1. Copy dist/marketplace-export/skills/* to marketing site content/marketplace/skills/');
  console.log('  2. Run npm run build:registry in the marketing site repo');
}

/**
 * Maps skill.json category names to marketplace categories.
 */
function mapCategory(category: string): string {
  const mapping: Record<string, string> = {
    'task-management': 'automation',
    'communication': 'communication',
    'monitoring': 'analysis',
    'development': 'development',
    'knowledge': 'research',
    'quality': 'quality',
    'integration': 'integration',
    'content-creation': 'content-creation',
  };
  return mapping[category] || 'development';
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
