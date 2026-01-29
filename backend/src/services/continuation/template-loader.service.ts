/**
 * Template Loader Service
 *
 * Loads and processes continuation prompt templates with variable
 * substitution, conditionals, and loop support.
 *
 * @module services/continuation/template-loader.service
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { LoggerService, ComponentLogger } from '../core/logger.service.js';

/**
 * Template metadata from frontmatter
 */
export interface TemplateMetadata {
  /** Template name */
  name: string;
  /** Template description */
  description: string;
  /** List of required variables */
  variables: string[];
}

/**
 * Parsed template with metadata and content
 */
export interface ParsedTemplate {
  /** Template metadata from frontmatter */
  metadata: TemplateMetadata;
  /** Template content (without frontmatter) */
  content: string;
}

/**
 * Interface for template loading and processing
 */
export interface ITemplateLoader {
  /**
   * Load a template by name
   *
   * @param name - Template name (without .md extension)
   * @returns Template content
   */
  loadTemplate(name: string): Promise<string>;

  /**
   * Load and parse a template with metadata
   *
   * @param name - Template name
   * @returns Parsed template with metadata
   */
  loadParsedTemplate(name: string): Promise<ParsedTemplate>;

  /**
   * Substitute variables in a template
   *
   * @param template - Template content
   * @param variables - Variables to substitute
   * @returns Processed template
   */
  substituteVariables(template: string, variables: Record<string, unknown>): string;

  /**
   * Clear the template cache
   */
  clearCache(): void;
}

/**
 * Service for loading and processing continuation prompt templates
 *
 * Features:
 * - Load templates from config directory
 * - Parse YAML frontmatter for metadata
 * - Variable substitution with {{VAR_NAME}} syntax
 * - Conditional blocks with {{#if VAR}}...{{/if}}
 * - Template caching for performance
 *
 * @example
 * ```typescript
 * const loader = TemplateLoader.getInstance();
 *
 * const template = await loader.loadTemplate('continue-work');
 * const prompt = loader.substituteVariables(template, {
 *   CURRENT_TASK: 'Fix authentication bug',
 *   ITERATIONS: 3,
 *   MAX_ITERATIONS: 10,
 * });
 * ```
 */
export class TemplateLoader implements ITemplateLoader {
  private static instance: TemplateLoader | null = null;

  private readonly logger: ComponentLogger;
  private readonly templateDir: string;
  private readonly cache: Map<string, ParsedTemplate> = new Map();

  /**
   * Creates a new TemplateLoader
   *
   * @param templateDir - Optional custom template directory
   */
  private constructor(templateDir?: string) {
    this.logger = LoggerService.getInstance().createComponentLogger('TemplateLoader');
    this.templateDir = templateDir || path.join(process.cwd(), 'config', 'continuation', 'prompts');
  }

  /**
   * Gets the singleton instance
   *
   * @returns The TemplateLoader instance
   */
  public static getInstance(): TemplateLoader {
    if (!TemplateLoader.instance) {
      TemplateLoader.instance = new TemplateLoader();
    }
    return TemplateLoader.instance;
  }

  /**
   * Clears the singleton instance (for testing)
   */
  public static clearInstance(): void {
    TemplateLoader.instance = null;
  }

  /**
   * Create an instance with a custom template directory (for testing)
   *
   * @param templateDir - Custom template directory
   * @returns TemplateLoader instance
   */
  public static createWithDir(templateDir: string): TemplateLoader {
    return new TemplateLoader(templateDir);
  }

  /**
   * Load a template by name
   *
   * @param name - Template name (without .md extension)
   * @returns Template content (without frontmatter)
   */
  public async loadTemplate(name: string): Promise<string> {
    const parsed = await this.loadParsedTemplate(name);
    return parsed.content;
  }

  /**
   * Load and parse a template with metadata
   *
   * @param name - Template name
   * @returns Parsed template with metadata
   */
  public async loadParsedTemplate(name: string): Promise<ParsedTemplate> {
    // Check cache first
    if (this.cache.has(name)) {
      this.logger.debug('Template loaded from cache', { name });
      return this.cache.get(name)!;
    }

    // Load from file
    const filePath = path.join(this.templateDir, `${name}.md`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = this.parseTemplate(content, name);

      // Cache the result
      this.cache.set(name, parsed);
      this.logger.debug('Template loaded and cached', { name });

      return parsed;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to load template', { name, error: message });
      throw new Error(`Failed to load template '${name}': ${message}`);
    }
  }

  /**
   * Parse template content and extract frontmatter
   *
   * @param content - Raw template content
   * @param name - Template name (used as fallback)
   * @returns Parsed template
   */
  private parseTemplate(content: string, name: string): ParsedTemplate {
    // Check for frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

    if (!frontmatterMatch) {
      // No frontmatter, use defaults
      return {
        metadata: {
          name,
          description: '',
          variables: [],
        },
        content: content.trim(),
      };
    }

    const [, frontmatterStr, templateContent] = frontmatterMatch;
    const metadata = this.parseFrontmatter(frontmatterStr, name);

    return {
      metadata,
      content: templateContent.trim(),
    };
  }

  /**
   * Parse YAML-like frontmatter
   *
   * @param frontmatter - Frontmatter string
   * @param defaultName - Default name if not specified
   * @returns Template metadata
   */
  private parseFrontmatter(frontmatter: string, defaultName: string): TemplateMetadata {
    const metadata: TemplateMetadata = {
      name: defaultName,
      description: '',
      variables: [],
    };

    const lines = frontmatter.split('\n');
    let currentKey: string | null = null;

    for (const line of lines) {
      // Key-value pair
      const kvMatch = line.match(/^(\w+):\s*(.*)$/);
      if (kvMatch) {
        const [, key, value] = kvMatch;
        currentKey = key;

        if (key === 'name') {
          metadata.name = value.trim();
        } else if (key === 'description') {
          metadata.description = value.trim();
        } else if (key === 'variables' && value.trim()) {
          // Inline array format: variables: [VAR1, VAR2]
          const arrayMatch = value.match(/\[(.*)\]/);
          if (arrayMatch) {
            metadata.variables = arrayMatch[1].split(',').map((v) => v.trim());
          }
        }
        continue;
      }

      // Array item (for variables)
      const arrayItemMatch = line.match(/^\s+-\s+(.+)$/);
      if (arrayItemMatch && currentKey === 'variables') {
        metadata.variables.push(arrayItemMatch[1].trim());
      }
    }

    return metadata;
  }

  /**
   * Substitute variables in a template
   *
   * @param template - Template content
   * @param variables - Variables to substitute
   * @returns Processed template
   */
  public substituteVariables(template: string, variables: Record<string, unknown>): string {
    let result = template;

    // Process conditionals first
    result = this.processConditionals(result, variables);

    // Then substitute simple variables
    result = this.substituteSimpleVariables(result, variables);

    return result;
  }

  /**
   * Substitute simple {{VAR_NAME}} variables
   *
   * @param template - Template content
   * @param variables - Variables to substitute
   * @returns Template with variables substituted
   */
  private substituteSimpleVariables(template: string, variables: Record<string, unknown>): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, this.formatValue(value));
    }

    // Also handle computed variables
    if (variables.MAX_ITERATIONS && variables.ITERATIONS) {
      const remaining = Number(variables.MAX_ITERATIONS) - Number(variables.ITERATIONS);
      result = result.replace(/\{\{REMAINING_ITERATIONS\}\}/g, String(remaining));
    }

    // Remove any remaining unsubstituted variables (missing from input)
    result = result.replace(/\{\{\w+\}\}/g, '');

    return result;
  }

  /**
   * Process conditional blocks: {{#if VAR}}...{{/if}}
   *
   * @param template - Template content
   * @param variables - Variables for conditions
   * @returns Template with conditionals processed
   */
  private processConditionals(template: string, variables: Record<string, unknown>): string {
    let result = template;

    // Match {{#if VAR}}...{{/if}} blocks
    const conditionalRegex = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;

    result = result.replace(conditionalRegex, (match, varName, content) => {
      const value = variables[varName];
      const isTruthy = this.isTruthy(value);

      if (isTruthy) {
        // Include the content
        return content;
      } else {
        // Exclude the content
        return '';
      }
    });

    return result;
  }

  /**
   * Check if a value is truthy for conditionals
   *
   * @param value - Value to check
   * @returns True if truthy
   */
  private isTruthy(value: unknown): boolean {
    if (value === undefined || value === null) {
      return false;
    }
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === 'object') {
      return Object.keys(value).length > 0;
    }
    return Boolean(value);
  }

  /**
   * Format a value for substitution
   *
   * @param value - Value to format
   * @returns Formatted string
   */
  private formatValue(value: unknown): string {
    if (value === undefined || value === null) {
      return '';
    }
    if (Array.isArray(value)) {
      return value.map((item) => `- ${String(item)}`).join('\n');
    }
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  }

  /**
   * Clear the template cache
   */
  public clearCache(): void {
    this.cache.clear();
    this.logger.debug('Template cache cleared');
  }

  /**
   * Check if a template exists
   *
   * @param name - Template name
   * @returns True if exists
   */
  public async templateExists(name: string): Promise<boolean> {
    const filePath = path.join(this.templateDir, `${name}.md`);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all available templates
   *
   * @returns Array of template names
   */
  public async listTemplates(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.templateDir);
      return files.filter((f) => f.endsWith('.md')).map((f) => f.replace('.md', ''));
    } catch {
      return [];
    }
  }
}
