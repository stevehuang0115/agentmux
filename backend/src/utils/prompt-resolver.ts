import { readFile } from 'fs/promises';
import { join, resolve } from 'path';
import { existsSync } from 'fs';

/**
 * Interface for step configuration that may have either prompts array or prompt_file reference
 */
export interface StepConfig {
  id: number;
  name: string;
  targetRole: string;
  delayMinutes?: number;
  conditional?: string;
  verification?: any;
  prompt_file?: string;  // New field for referencing markdown files
  prompts?: string[];    // Legacy field for backward compatibility
}

/**
 * Loads and processes prompt content from markdown files or inline arrays
 *
 * @param step - Step configuration object with either prompt_file or prompts
 * @param projectVars - Variables for template replacement
 * @returns Promise resolving to array of processed prompt strings
 *
 * @example
 * ```typescript
 * const step = { prompt_file: "config/task_starters/prompts/build_spec_step1.md" };
 * const prompts = await resolveStepPrompts(step, { PROJECT_NAME: "MyApp" });
 * ```
 */
export async function resolveStepPrompts(
  step: StepConfig,
  projectVars: Record<string, string> = {}
): Promise<string[]> {
  let promptContent: string;

  // If step has prompt_file, load from markdown file
  if (step.prompt_file) {
    const promptFilePath = resolve(process.cwd(), step.prompt_file);

    if (!existsSync(promptFilePath)) {
      throw new Error(`Prompt file not found: ${step.prompt_file}`);
    }

    try {
      promptContent = await readFile(promptFilePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read prompt file ${step.prompt_file}: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Convert markdown content to prompts array
    // Split by double newlines to create logical sections
    const prompts = splitMarkdownIntoPrompts(promptContent);

    // Apply template variable replacements
    return prompts.map(prompt => replaceTemplateVariables(prompt, projectVars));
  }

  // Fall back to legacy prompts array if no prompt_file
  if (step.prompts && Array.isArray(step.prompts)) {
    return step.prompts.map(prompt => replaceTemplateVariables(prompt, projectVars));
  }

  // If neither prompt_file nor prompts are available, return empty array
  console.warn(`Step ${step.id} (${step.name}) has no prompt_file or prompts array`);
  return [];
}

/**
 * Splits markdown content into logical prompt sections
 *
 * @param markdown - Raw markdown content from prompt file
 * @returns Array of prompt strings, each representing a logical section
 */
function splitMarkdownIntoPrompts(markdown: string): string[] {
  // Remove frontmatter if present
  const contentWithoutFrontmatter = markdown.replace(/^---[\s\S]*?---\n/, '');

  // For now, always return the entire content as a single prompt
  // This ensures template variables are preserved and processed correctly
  // Future enhancement: implement more sophisticated sectioning if needed
  return [contentWithoutFrontmatter.trim()];
}

/**
 * Replaces template variables in prompt content
 *
 * @param prompt - Prompt string with template variables
 * @param vars - Object containing variable values for replacement
 * @returns Prompt string with variables replaced
 *
 * @example
 * ```typescript
 * const result = replaceTemplateVariables(
 *   "Project: {PROJECT_NAME} at {PROJECT_PATH}",
 *   { PROJECT_NAME: "MyApp", PROJECT_PATH: "/home/user/myapp" }
 * );
 * // Returns: "Project: MyApp at /home/user/myapp"
 * ```
 */
export function replaceTemplateVariables(prompt: string, vars: Record<string, string>): string {
  let result = prompt;

  // Apply all variable replacements
  Object.entries(vars).forEach(([key, value]) => {
    const pattern = new RegExp(`\\{${key}\\}`, 'g');
    result = result.replace(pattern, value);
  });

  return result;
}

/**
 * Enhanced step configuration resolver that ensures backward compatibility
 * Resolves prompts and adds the prompts array back to the step object
 *
 * @param step - Original step configuration
 * @param projectVars - Variables for template replacement
 * @returns Promise resolving to step configuration with resolved prompts array
 */
export async function resolveStepConfig(
  step: StepConfig,
  projectVars: Record<string, string> = {}
): Promise<StepConfig & { prompts: string[] }> {
  const resolvedPrompts = await resolveStepPrompts(step, projectVars);

  return {
    ...step,
    prompts: resolvedPrompts
  };
}

/**
 * Batch resolver for multiple steps from a configuration file
 *
 * @param steps - Array of step configurations
 * @param projectVars - Variables for template replacement
 * @returns Promise resolving to array of steps with resolved prompts
 */
export async function resolveMultipleSteps(
  steps: StepConfig[],
  projectVars: Record<string, string> = {}
): Promise<Array<StepConfig & { prompts: string[] }>> {
  const resolvedSteps = await Promise.all(
    steps.map(step => resolveStepConfig(step, projectVars))
  );

  return resolvedSteps;
}

/**
 * Utility to load and resolve a complete configuration file
 *
 * @param configPath - Path to JSON configuration file
 * @param projectVars - Variables for template replacement
 * @returns Promise resolving to configuration with resolved prompts
 */
export async function loadAndResolveConfig(
  configPath: string,
  projectVars: Record<string, string> = {}
): Promise<{ steps: Array<StepConfig & { prompts: string[] }>; [key: string]: any }> {
  const fullPath = resolve(process.cwd(), configPath);

  if (!existsSync(fullPath)) {
    throw new Error(`Configuration file not found: ${configPath}`);
  }

  const configContent = JSON.parse(await readFile(fullPath, 'utf-8'));

  if (!configContent.steps || !Array.isArray(configContent.steps)) {
    throw new Error(`Invalid configuration: missing or invalid steps array in ${configPath}`);
  }

  const resolvedSteps = await resolveMultipleSteps(configContent.steps, projectVars);

  return {
    ...configContent,
    steps: resolvedSteps
  };
}