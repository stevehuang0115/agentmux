/**
 * CLI Onboard Command
 *
 * Interactive setup wizard that walks new users through configuring Crewly.
 * Detects AI providers, installs missing tools, and installs agent skills
 * from the marketplace.
 *
 * Used directly via `crewly onboard`, by the curl install script, and
 * by the Electron desktop app.
 *
 * Supports non-interactive mode via `--yes` flag and direct template
 * selection via `--template <id>`.
 *
 * @module cli/commands/onboard
 */

import { createInterface, type Interface as ReadlineInterface } from 'readline';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import {
  checkSkillsInstalled,
  installAllSkills,
} from '../utils/marketplace.js';
import {
  listTemplates,
  getTemplate,
  type TeamTemplate,
} from '../utils/templates.js';

/** Provider choice returned by the selection step */
export type ProviderChoice = 'claude' | 'gemini' | 'both' | 'skip';

/** Options passed from Commander.js for the onboard command */
export interface OnboardOptions {
  /** Skip all interactive prompts and use defaults */
  yes?: boolean;
  /** Select a team template by ID (e.g. "web-dev-team") */
  template?: string;
}

// ========================= Banner =========================

/**
 * Prints the Crewly ASCII art banner to stdout.
 */
export function printBanner(): void {
  console.log(chalk.cyan(`
   ____                    _
  / ___|_ __ _____      _| |_   _
 | |   | '__/ _ \\ \\ /\\ / / | | | |
 | |___| | |  __/\\ V  V /| | |_| |
  \\____|_|  \\___| \\_/\\_/ |_|\\__, |
                              |___/
`));
  console.log(chalk.bold('  Welcome to Crewly! Let\'s get you set up.\n'));
}

// ========================= Readline helpers =========================

/**
 * Creates a readline interface attached to stdin/stdout.
 *
 * @returns A readline interface
 */
export function createReadlineInterface(): ReadlineInterface {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * Prompts the user with a question and returns their answer.
 *
 * @param rl - Readline interface
 * @param question - The prompt text
 * @returns The user's response string
 */
function ask(rl: ReadlineInterface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// ========================= Step 1: Provider selection =========================

/**
 * Asks the user which AI coding assistant they use.
 *
 * Displays a numbered menu and returns the user's choice.
 *
 * @param rl - Readline interface
 * @returns The selected provider choice
 */
export async function selectProvider(rl: ReadlineInterface): Promise<ProviderChoice> {
  console.log(chalk.bold('  Step 1/5: AI Provider'));
  console.log('  Which AI coding assistant do you use?\n');
  console.log('    1. Claude Code (Anthropic)');
  console.log('    2. Gemini CLI (Google)');
  console.log('    3. Both');
  console.log('    4. Skip\n');

  const choices: Record<string, ProviderChoice> = {
    '1': 'claude',
    '2': 'gemini',
    '3': 'both',
    '4': 'skip',
  };

  while (true) {
    const answer = await ask(rl, '  Enter choice (1-4): ');
    const choice = choices[answer];
    if (choice) {
      console.log('');
      return choice;
    }
    console.log(chalk.yellow('  Please enter 1, 2, 3, or 4.'));
  }
}

// ========================= Step 2: Tool detection & install =========================

/**
 * Checks whether a CLI tool is installed by running `which <command>`.
 *
 * @param command - The command name to look for (e.g. "claude")
 * @returns True if the command is found on the PATH
 */
export function checkToolInstalled(command: string): boolean {
  try {
    execSync(`which ${command}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the version of an installed CLI tool.
 *
 * @param command - The command name
 * @param versionFlag - The flag to get version (default: "--version")
 * @returns The version string or null if not determinable
 */
export function getToolVersion(command: string, versionFlag = '--version'): string | null {
  try {
    const output = execSync(`${command} ${versionFlag} 2>/dev/null`, {
      stdio: 'pipe',
      timeout: 10000,
    }).toString().trim();
    // Extract first version-like pattern
    const match = output.match(/\d+\.\d+[\w.-]*/);
    return match ? match[0] : output.split('\n')[0];
  } catch {
    return null;
  }
}

/**
 * Installs a tool via npm globally.
 *
 * @param displayName - Human-readable tool name for output
 * @param npmPackage - The npm package name to install
 * @returns True if installation succeeded
 */
export function installTool(displayName: string, npmPackage: string): boolean {
  try {
    console.log(chalk.blue(`  Installing ${displayName}...`));
    execSync(`npm install -g ${npmPackage}`, {
      stdio: 'pipe',
      timeout: 120000,
    });
    console.log(chalk.green(`  ✓ ${displayName} installed`));
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(chalk.red(`  ✗ Failed to install ${displayName}: ${msg}`));
    return false;
  }
}

/** Tool descriptor for detection and installation */
interface ToolInfo {
  displayName: string;
  command: string;
  npmPackage: string;
}

/** Map of provider choices to the tools they require */
const PROVIDER_TOOLS: Record<string, ToolInfo[]> = {
  claude: [
    { displayName: 'Claude Code', command: 'claude', npmPackage: '@anthropic-ai/claude-code' },
  ],
  gemini: [
    { displayName: 'Gemini CLI', command: 'gemini', npmPackage: '@anthropic-ai/gemini-cli' },
  ],
  both: [
    { displayName: 'Claude Code', command: 'claude', npmPackage: '@anthropic-ai/claude-code' },
    { displayName: 'Gemini CLI', command: 'gemini', npmPackage: '@anthropic-ai/gemini-cli' },
  ],
  skip: [],
};

/**
 * Checks for and optionally installs the tools needed for the selected provider.
 *
 * For each required tool, checks if it's on the PATH. If missing, asks the user
 * whether to install it via npm. In non-interactive (--yes) mode, automatically
 * installs missing tools.
 *
 * @param rl - Readline interface
 * @param provider - The chosen provider
 * @param autoYes - When true, skip prompts and install missing tools automatically
 */
export async function ensureTools(rl: ReadlineInterface, provider: ProviderChoice, autoYes = false): Promise<void> {
  console.log(chalk.bold('  Step 2/5: Tool Installation'));

  const tools = PROVIDER_TOOLS[provider] || [];

  if (tools.length === 0) {
    console.log(chalk.gray('  Skipped tool installation.\n'));
    return;
  }

  for (const tool of tools) {
    if (checkToolInstalled(tool.command)) {
      const version = getToolVersion(tool.command);
      const versionStr = version ? ` (v${version})` : '';
      console.log(chalk.green(`  ✓ ${tool.displayName} detected${versionStr}`));
    } else {
      console.log(chalk.yellow(`  ⚠ ${tool.displayName} not found.`));
      if (autoYes) {
        installTool(tool.displayName, tool.npmPackage);
      } else {
        const answer = await ask(rl, `  Install ${tool.displayName} now? [Y/n] `);
        if (answer === '' || answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
          installTool(tool.displayName, tool.npmPackage);
        } else {
          console.log(chalk.gray(`  Skipped ${tool.displayName} installation.`));
        }
      }
    }
  }

  console.log('');
}

// ========================= Step 3: Skills =========================

/**
 * Checks for and installs agent skills from the marketplace.
 *
 * If skills are already installed, reports the count. Otherwise, downloads
 * and installs all skills with progress feedback.
 */
export async function ensureSkills(): Promise<void> {
  console.log(chalk.bold('  Step 3/5: Agent Skills'));

  try {
    const { installed, total } = await checkSkillsInstalled();

    if (installed >= total && total > 0) {
      console.log(chalk.green(`  ✓ ${installed} agent skills already installed\n`));
      return;
    }

    if (total === 0) {
      console.log(chalk.yellow('  No skills available in the marketplace.\n'));
      return;
    }

    console.log(chalk.blue(`  Installing ${total} agent skills from marketplace...`));

    const count = await installAllSkills((name, index, skillTotal) => {
      console.log(chalk.gray(`  [${index}/${skillTotal}] ${name}`));
    });

    console.log(chalk.green(`  ✓ ${count} skills installed\n`));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(chalk.yellow(`  ⚠ Could not install skills: ${msg}`));
    console.log(chalk.gray('  Run \'crewly install --all\' later to install skills.\n'));
  }
}

// ========================= Step 4: Team Template =========================

/**
 * Asks the user to pick a pre-built team template.
 *
 * Displays available templates with descriptions. The user can pick one
 * or skip to configure their team later through the dashboard.
 *
 * @param rl - Readline interface
 * @returns The selected template, or null if skipped
 */
export async function selectTemplate(rl: ReadlineInterface): Promise<TeamTemplate | null> {
  console.log(chalk.bold('  Step 4/5: Team Template'));
  console.log('  Choose a pre-built team to get started quickly:\n');

  const templates = listTemplates();

  if (templates.length === 0) {
    console.log(chalk.gray('  No templates available.\n'));
    return null;
  }

  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    const members = t.members.map(m => m.name).join(', ');
    console.log(`    ${i + 1}. ${chalk.bold(t.name)}`);
    console.log(chalk.gray(`       ${t.description}`));
    console.log(chalk.gray(`       Members: ${members}\n`));
  }
  console.log(`    ${templates.length + 1}. Skip (configure later in dashboard)\n`);

  const maxChoice = templates.length + 1;

  while (true) {
    const answer = await ask(rl, `  Enter choice (1-${maxChoice}): `);
    const num = parseInt(answer, 10);
    if (num >= 1 && num <= templates.length) {
      const selected = templates[num - 1];
      console.log(chalk.green(`  ✓ Selected: ${selected.name}\n`));
      return selected;
    }
    if (num === maxChoice || answer === '') {
      console.log(chalk.gray('  Skipped team template.\n'));
      return null;
    }
    console.log(chalk.yellow(`  Please enter 1-${maxChoice}.`));
  }
}

// ========================= Directory Scaffolding =========================

/**
 * Scaffolds the .crewly/ directory in the current working directory.
 *
 * Creates the minimum directory structure needed for `crewly start` to work:
 * - .crewly/
 * - .crewly/docs/
 * - .crewly/memory/
 * - .crewly/tasks/
 * - .crewly/teams/
 *
 * If the directory already exists, reports it and moves on.
 *
 * @param projectDir - The project root directory (defaults to process.cwd())
 * @returns True if the directory was created or already existed
 */
export function scaffoldCrewlyDirectory(projectDir: string = process.cwd()): boolean {
  const crewlyDir = join(projectDir, '.crewly');

  if (existsSync(crewlyDir)) {
    console.log(chalk.green('  ✓ .crewly/ directory already exists'));
    return true;
  }

  try {
    const subdirs = ['docs', 'memory', 'tasks', 'teams'];
    for (const subdir of subdirs) {
      mkdirSync(join(crewlyDir, subdir), { recursive: true });
    }

    // Write minimal config.env
    writeFileSync(
      join(crewlyDir, 'config.env'),
      '# Crewly configuration\n# Add API keys and settings here\n',
    );

    console.log(chalk.green('  ✓ .crewly/ directory created'));
    return true;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(chalk.red(`  ✗ Failed to create .crewly/ directory: ${msg}`));
    return false;
  }
}

// ========================= Step 5: Summary =========================

/**
 * Prints the setup-complete summary with next-step instructions.
 *
 * If a team template was selected, includes instructions on how to
 * create the team from the dashboard.
 *
 * @param selectedTemplate - The template chosen during onboarding, or null
 * @param projectDir - The project directory path for next-steps output
 */
export function printSummary(selectedTemplate: TeamTemplate | null = null, projectDir?: string): void {
  console.log(chalk.bold('  Step 5/5: Done!'));
  console.log(chalk.green('  ✓ Setup complete!\n'));

  if (selectedTemplate) {
    console.log(`  Your team template: ${chalk.bold(selectedTemplate.name)}`);
    console.log(`  Members: ${selectedTemplate.members.map(m => m.name).join(', ')}\n`);
  }

  console.log(chalk.bold('  Next steps:\n'));

  if (projectDir && projectDir !== process.cwd()) {
    console.log(chalk.cyan(`    cd ${projectDir}`));
  }
  console.log(chalk.cyan('    crewly start\n'));

  if (selectedTemplate) {
    console.log('  The dashboard will offer to create your team from the');
    console.log(`  "${selectedTemplate.name}" template when you start.\n`);
  }
}

// ========================= Main command =========================

/**
 * Runs the onboarding wizard.
 *
 * In interactive mode (default), walks the user through 5 steps:
 * 1. Choose an AI provider (Claude Code, Gemini CLI, both, or skip)
 * 2. Detect / install the chosen tool(s)
 * 3. Install agent skills from the marketplace
 * 4. Pick a team template (or skip)
 * 5. Print a success summary
 *
 * In non-interactive mode (--yes), uses defaults:
 * - Provider: claude
 * - Auto-install missing tools
 * - First available template (or --template flag)
 * - Scaffold .crewly/ directory
 *
 * @param options - Command options from Commander.js
 */
export async function onboardCommand(options: OnboardOptions = {}): Promise<void> {
  printBanner();

  const autoYes = options.yes === true;

  // Handle --template flag: look up template by ID
  let preselectedTemplate: TeamTemplate | null = null;
  if (options.template) {
    const found = getTemplate(options.template);
    if (found) {
      preselectedTemplate = found;
    } else {
      console.log(chalk.yellow(`  ⚠ Template "${options.template}" not found.`));
      const available = listTemplates();
      if (available.length > 0) {
        console.log(chalk.gray(`  Available templates: ${available.map(t => t.id).join(', ')}\n`));
      }
    }
  }

  if (autoYes) {
    // Non-interactive mode: use defaults
    const provider: ProviderChoice = 'claude';
    console.log(chalk.gray('  Running in non-interactive mode (--yes)\n'));

    // Step 1: Default provider
    console.log(chalk.bold('  Step 1/5: AI Provider'));
    console.log(chalk.green(`  ✓ Using default: Claude Code\n`));

    // Step 2: Auto-install tools
    await ensureTools(createReadlineInterface(), provider, true);

    // Step 3: Skills
    await ensureSkills();

    // Step 4: Template — use preselected or first available
    console.log(chalk.bold('  Step 4/5: Team Template'));
    const selectedTemplate = preselectedTemplate ?? listTemplates()[0] ?? null;
    if (selectedTemplate) {
      console.log(chalk.green(`  ✓ Using template: ${selectedTemplate.name}\n`));
    } else {
      console.log(chalk.gray('  No templates available.\n'));
    }

    // Scaffold .crewly/ directory
    scaffoldCrewlyDirectory();

    // Step 5: Summary
    printSummary(selectedTemplate);
    return;
  }

  // Interactive mode
  const rl = createReadlineInterface();

  try {
    // Step 1: Provider selection
    const provider = await selectProvider(rl);

    // Step 2: Tool installation
    await ensureTools(rl, provider);

    // Step 3: Skills
    await ensureSkills();

    // Step 4: Team template — preselected or interactive
    let selectedTemplate: TeamTemplate | null;
    if (preselectedTemplate) {
      console.log(chalk.bold('  Step 4/5: Team Template'));
      console.log(chalk.green(`  ✓ Using template: ${preselectedTemplate.name}\n`));
      selectedTemplate = preselectedTemplate;
    } else {
      selectedTemplate = await selectTemplate(rl);
    }

    // Scaffold .crewly/ directory
    scaffoldCrewlyDirectory();

    // Step 5: Summary
    printSummary(selectedTemplate);
  } finally {
    rl.close();
  }
}
