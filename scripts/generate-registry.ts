#!/usr/bin/env tsx
/**
 * Generate Registry Index
 *
 * Scans config/skills/agent/marketplace/{name}/skill.json and generates
 * config/skills/registry.json containing metadata for all downloadable marketplace skills. This registry is committed
 * to the repo and served via GitHub raw content for npm users who don't have the
 * skill source files.
 *
 * Run: npx tsx scripts/generate-registry.ts
 *
 * @module scripts/generate-registry
 */

import path from 'path';
import { readdir, readFile, writeFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { MARKETPLACE_CONSTANTS } from '../config/constants.js';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const MARKETPLACE_SKILLS_DIR = path.join(PROJECT_ROOT, 'config', 'skills', 'agent', 'marketplace');
const REGISTRY_OUTPUT = path.join(PROJECT_ROOT, 'config', 'skills', 'registry.json');

interface SkillJson {
  id: string;
  name: string;
  description: string;
  category: string;
  version?: string;
  tags?: string[];
  skillType?: string;
  assignableRoles?: string[];
  triggers?: string[];
  license?: string;
  author?: string;
}

interface RegistryItem {
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
  source: string;
  assets: {
    archive: string;
    checksum: string;
    sizeBytes: number;
  };
  metadata?: {
    skillType?: string;
    assignableRoles?: string[];
    triggers?: string[];
  };
}

interface Registry {
  schemaVersion: number;
  lastUpdated: string;
  cdnBaseUrl: string;
  source: string;
  items: RegistryItem[];
}

async function main(): Promise<void> {
  console.log('Generating registry.json from marketplace skills...\n');

  if (!existsSync(MARKETPLACE_SKILLS_DIR)) {
    console.error(`Marketplace skills directory not found: ${MARKETPLACE_SKILLS_DIR}`);
    process.exit(1);
  }

  const entries = await readdir(MARKETPLACE_SKILLS_DIR, { withFileTypes: true });
  const skillDirs = entries
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  const items: RegistryItem[] = [];
  const now = new Date().toISOString();

  for (const entry of skillDirs) {
    const skillDir = path.join(MARKETPLACE_SKILLS_DIR, entry.name);
    const skillJsonPath = path.join(skillDir, 'skill.json');

    if (!existsSync(skillJsonPath)) {
      console.log(`  SKIP ${entry.name} (no skill.json)`);
      continue;
    }

    const skillJson: SkillJson = JSON.parse(await readFile(skillJsonPath, 'utf-8'));

    // Validate required fields
    if (!skillJson.id || !skillJson.name) {
      console.log(`  SKIP ${entry.name} (missing id or name)`);
      continue;
    }

    const version = skillJson.version || '1.0.0';

    // Estimate skill size by summing file sizes in the directory
    let totalSize = 0;
    const files = await readdir(skillDir);
    for (const file of files) {
      const fileStat = await stat(path.join(skillDir, file));
      if (fileStat.isFile()) {
        totalSize += fileStat.size;
      }
    }

    const item: RegistryItem = {
      id: skillJson.id,
      type: 'skill',
      name: skillJson.name,
      description: skillJson.description,
      author: skillJson.author || 'Crewly Team',
      version,
      category: MARKETPLACE_CONSTANTS.CATEGORY_MAP[skillJson.category] || 'development',
      tags: skillJson.tags || [],
      license: skillJson.license || 'MIT',
      downloads: 0,
      rating: 0,
      createdAt: now,
      updatedAt: now,
      source: `config/skills/agent/marketplace/${entry.name}`,
      assets: {
        archive: `config/skills/agent/marketplace/${entry.name}`,
        checksum: '',
        sizeBytes: totalSize,
      },
      metadata: {
        skillType: skillJson.skillType,
        assignableRoles: skillJson.assignableRoles,
        triggers: skillJson.triggers,
      },
    };

    items.push(item);
    console.log(`  + ${skillJson.name.padEnd(30)} v${version}`);
  }

  const registry: Registry = {
    schemaVersion: MARKETPLACE_CONSTANTS.SCHEMA_VERSION,
    lastUpdated: now,
    cdnBaseUrl: MARKETPLACE_CONSTANTS.PUBLIC_CDN_BASE,
    source: 'github',
    items,
  };

  await writeFile(REGISTRY_OUTPUT, JSON.stringify(registry, null, 2) + '\n');

  console.log(`\nDone! ${items.length} skills indexed to ${REGISTRY_OUTPUT}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
