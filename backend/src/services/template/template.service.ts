/**
 * Template Service
 *
 * Loads, lists, and applies team templates from config/templates/.
 * Supports both the new TeamTemplate format (with verificationPipeline)
 * and legacy flat JSON format (backward compatible).
 *
 * When connected to CrewlyAI Cloud, also fetches premium templates
 * and merges them with local templates. Premium templates are held
 * in memory only and never written to disk.
 *
 * @module services/template/template
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { randomUUID } from 'crypto';
import type { TeamTemplate, TemplateRole } from '../../types/team-template.types.js';
import { isValidTeamTemplate } from '../../types/team-template.types.js';
import type { TeamMember, Team, TeamMemberRole } from '../../types/index.js';
import { CloudClientService } from '../cloud/cloud-client.service.js';
import type { CloudTemplateSummary, CloudTemplateDetail } from '../cloud/cloud-client.service.js';
import type { CloudTier } from '../../constants.js';

// =============================================================================
// Constants
// =============================================================================

/** Default path to templates directory */
const DEFAULT_TEMPLATES_DIR = resolve(process.cwd(), 'config/templates');

// =============================================================================
// Types
// =============================================================================

/** Result of creating a team from a template */
export interface CreateFromTemplateResult {
  /** The created team */
  team: Team;
  /** Template ID used */
  templateId: string;
  /** Number of members created */
  memberCount: number;
}

/** Template source — local disk or CrewlyAI Cloud */
export type TemplateSource = 'local' | 'cloud';

/** Minimal template summary for listing */
export interface TemplateSummary {
  id: string;
  name: string;
  description: string;
  category: string;
  hierarchical: boolean;
  roleCount: number;
  version: string;
  tags?: string[];
  icon?: string;
  /** Where this template was loaded from */
  source: TemplateSource;
  /** Minimum subscription tier required (cloud templates only) */
  requiredTier?: CloudTier;
}

// =============================================================================
// Service
// =============================================================================

/**
 * TemplateService manages team templates.
 * Loads templates from config/templates/ directory, provides
 * listing/querying, and creates teams from templates.
 *
 * Singleton pattern matching other Crewly services.
 */
export class TemplateService {
  private static instance: TemplateService | null = null;

  /** Loaded templates indexed by ID */
  private templates: Map<string, TeamTemplate> = new Map();

  /** Templates directory path */
  private templatesDir: string;

  /** Whether templates have been loaded */
  private loaded: boolean = false;

  private constructor(templatesDir?: string) {
    this.templatesDir = templatesDir ?? DEFAULT_TEMPLATES_DIR;
  }

  /**
   * Get the singleton instance.
   *
   * @param templatesDir - Optional override for templates directory
   * @returns The singleton instance
   */
  static getInstance(templatesDir?: string): TemplateService {
    if (!TemplateService.instance) {
      TemplateService.instance = new TemplateService(templatesDir);
    }
    return TemplateService.instance;
  }

  /**
   * Clear the singleton instance (for testing).
   */
  static clearInstance(): void {
    TemplateService.instance = null;
  }

  /**
   * Load all templates from the templates directory.
   * Scans for template.json files in subdirectories and
   * legacy flat JSON files at the root level.
   *
   * @returns Number of templates loaded
   */
  loadTemplates(): number {
    this.templates.clear();

    if (!existsSync(this.templatesDir)) {
      this.loaded = true;
      return 0;
    }

    const entries = readdirSync(this.templatesDir);

    for (const entry of entries) {
      const fullPath = join(this.templatesDir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Check for template.json in subdirectory (new format)
        const templateJsonPath = join(fullPath, 'template.json');
        if (existsSync(templateJsonPath)) {
          this.loadTemplateFile(templateJsonPath, entry);
        }
      } else if (entry.endsWith('.json') && !entry.startsWith('.')) {
        // Legacy flat JSON at root level
        this.loadLegacyTemplate(fullPath, entry);
      }
    }

    this.loaded = true;
    return this.templates.size;
  }

  /**
   * List local templates as summaries.
   *
   * Returns only templates loaded from disk. For a combined list
   * that includes cloud premium templates, use {@link listAllTemplates}.
   *
   * @returns Array of local template summaries
   */
  listTemplates(): TemplateSummary[] {
    if (!this.loaded) this.loadTemplates();

    return Array.from(this.templates.values()).map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category,
      hierarchical: t.hierarchical,
      roleCount: t.roles.length,
      version: t.version,
      tags: t.tags,
      icon: t.icon,
      source: 'local' as TemplateSource,
    }));
  }

  /**
   * List all templates — local templates merged with cloud premium templates.
   *
   * When connected to CrewlyAI Cloud, concurrently fetches premium templates
   * and merges them with local ones. Cloud templates are marked with
   * `source: 'cloud'` and include `requiredTier`.
   *
   * Graceful degradation: if the cloud fetch fails, returns local templates
   * only without throwing.
   *
   * @returns Array of all template summaries (local + cloud)
   */
  async listAllTemplates(): Promise<TemplateSummary[]> {
    const localTemplates = this.listTemplates();

    const cloudClient = CloudClientService.getInstance();
    if (!cloudClient.isConnected()) {
      return localTemplates;
    }

    try {
      const cloudTemplates = await cloudClient.getTemplates();
      const cloudSummaries = this.mapCloudTemplatesToSummaries(cloudTemplates);

      // Merge: local first, then cloud (skip cloud IDs that collide with local)
      const localIds = new Set(localTemplates.map(t => t.id));
      const uniqueCloudSummaries = cloudSummaries.filter(t => !localIds.has(t.id));

      return [...localTemplates, ...uniqueCloudSummaries];
    } catch {
      // Graceful degradation — cloud fetch failed, return local only
      return localTemplates;
    }
  }

  /**
   * Get a premium template's full detail from CrewlyAI Cloud.
   *
   * The returned data is held in memory only and MUST NOT be persisted
   * to disk (security requirement from PRD Section 3.1).
   *
   * @param id - Cloud template identifier
   * @returns Template detail, or null if not connected or not found
   */
  async getCloudTemplateDetail(id: string): Promise<CloudTemplateDetail | null> {
    const cloudClient = CloudClientService.getInstance();
    if (!cloudClient.isConnected()) {
      return null;
    }

    try {
      return await cloudClient.getTemplateDetail(id);
    } catch {
      return null;
    }
  }

  /**
   * Get a specific template by ID.
   *
   * @param id - Template ID
   * @returns The template, or null if not found
   */
  getTemplate(id: string): TeamTemplate | null {
    if (!this.loaded) this.loadTemplates();
    return this.templates.get(id) ?? null;
  }

  /**
   * Create a team from a template.
   * Generates TeamMember objects with IDs, session names,
   * and hierarchy fields based on the template's role definitions.
   *
   * @param templateId - ID of the template to use
   * @param teamName - Name for the new team
   * @param nameOverrides - Optional map of role → custom name
   * @returns The created team result, or null if template not found
   */
  createTeamFromTemplate(
    templateId: string,
    teamName: string,
    nameOverrides?: Record<string, string>
  ): CreateFromTemplateResult | null {
    const template = this.getTemplate(templateId);
    if (!template) return null;

    const members: TeamMember[] = [];
    const memberIdsByRole = new Map<string, string[]>();

    // First pass: create all members
    for (const role of template.roles) {
      const roleMembers: string[] = [];

      for (let i = 0; i < role.count; i++) {
        const memberId = randomUUID();
        const suffix = role.count > 1 ? `${i + 1}` : '';
        const name = nameOverrides?.[role.role]
          ?? `${role.defaultName}${suffix}`;

        const member: TeamMember = {
          id: memberId,
          name,
          sessionName: '',
          role: role.role as TeamMemberRole,
          systemPrompt: role.promptAdditions ?? '',
          agentStatus: 'inactive',
          workingStatus: 'idle',
          runtimeType: role.runtimeOverride ?? template.defaultRuntime,
          hierarchyLevel: role.hierarchyLevel,
          canDelegate: role.canDelegate,
          skillOverrides: role.defaultSkills.length > 0 ? role.defaultSkills : undefined,
          excludedRoleSkills: role.excludedSkills,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        members.push(member);
        roleMembers.push(memberId);
      }

      memberIdsByRole.set(role.role, roleMembers);
    }

    // Second pass: wire up hierarchy (parentMemberId, subordinateIds)
    for (const role of template.roles) {
      const currentIds = memberIdsByRole.get(role.role) ?? [];
      if (role.reportsTo) {
        const parentIds = memberIdsByRole.get(role.reportsTo) ?? [];
        if (parentIds.length > 0) {
          const parentId = parentIds[0]; // Each child reports to first member of parent role
          for (const childId of currentIds) {
            const child = members.find(m => m.id === childId);
            if (child) child.parentMemberId = parentId;
          }
          // Update parent's subordinateIds
          const parent = members.find(m => m.id === parentId);
          if (parent) {
            parent.subordinateIds = [...(parent.subordinateIds ?? []), ...currentIds];
          }
        }
      }
    }

    // Find leader ID
    const leaderRole = template.roles.find(r => r.canDelegate && r.hierarchyLevel === 1);
    const leaderIds = leaderRole ? memberIdsByRole.get(leaderRole.role) : undefined;
    const leaderId = leaderIds?.[0];

    const team: Team = {
      id: randomUUID(),
      name: teamName,
      description: template.description,
      members,
      projectIds: [],
      hierarchical: template.hierarchical,
      leaderId,
      templateId: template.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return {
      team,
      templateId: template.id,
      memberCount: members.length,
    };
  }

  /**
   * Get the number of loaded templates.
   *
   * @returns Template count
   */
  getTemplateCount(): number {
    return this.templates.size;
  }

  // ===========================================================================
  // Private helpers
  // ===========================================================================

  /**
   * Convert cloud template summaries to the local TemplateSummary format.
   *
   * @param cloudTemplates - Array of cloud template summaries from the API
   * @returns Array of TemplateSummary with source 'cloud'
   */
  private mapCloudTemplatesToSummaries(cloudTemplates: CloudTemplateSummary[]): TemplateSummary[] {
    return cloudTemplates.map(ct => ({
      id: ct.id,
      name: ct.name,
      description: ct.description,
      category: ct.category,
      hierarchical: false,
      roleCount: 0,
      version: '1.0.0',
      source: 'cloud' as TemplateSource,
      requiredTier: ct.requiredTier,
    }));
  }

  /**
   * Load a new-format template.json file.
   */
  private loadTemplateFile(filePath: string, dirName: string): void {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Check if it's already the new format (has verificationPipeline)
      if (isValidTeamTemplate(data)) {
        this.templates.set(data.id, data);
        return;
      }

      // It might be an education-smb/insurance-smb style template.json (metadata only)
      // These don't have roles/verificationPipeline, skip them
    } catch {
      // Silently skip invalid files
    }
  }

  /**
   * Load a legacy flat JSON template (e.g., web-dev-team.json).
   * Converts to TeamTemplate format with sensible defaults.
   */
  private loadLegacyTemplate(filePath: string, fileName: string): void {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);

      // Legacy format has id, name, description, members[]
      if (!data.name || !Array.isArray(data.members)) return;

      const id = data.id ?? fileName.replace('.json', '');
      const roles: TemplateRole[] = data.members.map((m: { name: string; role: string; systemPrompt?: string }, i: number) => ({
        role: m.role ?? 'developer',
        label: m.name ?? `Member ${i + 1}`,
        defaultName: m.name ?? `Member ${i + 1}`,
        count: 1,
        hierarchyLevel: 2,
        canDelegate: false,
        defaultSkills: [],
        promptAdditions: m.systemPrompt,
      }));

      const template: TeamTemplate = {
        id,
        name: data.name,
        description: data.description ?? '',
        category: 'custom',
        version: '0.1.0',
        hierarchical: false,
        roles,
        defaultRuntime: 'claude-code',
        verificationPipeline: {
          name: 'Manual Review',
          steps: [{
            id: 'manual',
            name: 'Manual Review',
            description: 'Team leader reviews output manually',
            method: 'manual_review',
            critical: true,
            config: {},
          }],
          passPolicy: 'all',
          maxRetries: 1,
        },
      };

      this.templates.set(id, template);
    } catch {
      // Silently skip invalid files
    }
  }
}
