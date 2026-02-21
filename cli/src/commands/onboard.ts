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
 * @module cli/commands/onboard
 */

import { createInterface, type Interface as ReadlineInterface } from 'readline';
import { execSync } from 'child_process';
import chalk from 'chalk';
import {
  checkSkillsInstalled,
  installAllSkills,
} from '../utils/marketplace.js';

/** Provider choice returned by the selection step */
export type ProviderChoice = 'claude' | 'gemini' | 'both' | 'skip';

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
  console.log(chalk.bold('  Step 1/4: AI Provider'));
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
 * whether to install it via npm.
 *
 * @param rl - Readline interface
 * @param provider - The chosen provider
 */
export async function ensureTools(rl: ReadlineInterface, provider: ProviderChoice): Promise<void> {
  console.log(chalk.bold('  Step 2/4: Tool Installation'));

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
      const answer = await ask(rl, `  Install ${tool.displayName} now? [Y/n] `);
      if (answer === '' || answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        installTool(tool.displayName, tool.npmPackage);
      } else {
        console.log(chalk.gray(`  Skipped ${tool.displayName} installation.`));
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
  console.log(chalk.bold('  Step 3/4: Agent Skills'));

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

// ========================= Step 4: Summary =========================

/**
 * Prints the setup-complete summary with next-step instructions.
 */
export function printSummary(): void {
  console.log(chalk.bold('  Step 4/4: Done!'));
  console.log(chalk.green('  ✓ Setup complete!\n'));
  console.log('  To get started:');
  console.log(chalk.cyan('    cd your-project/'));
  console.log(chalk.cyan('    crewly start\n'));
}

// ========================= Main command =========================

/**
 * Runs the interactive onboarding wizard.
 *
 * Walks the user through 4 steps:
 * 1. Choose an AI provider (Claude Code, Gemini CLI, both, or skip)
 * 2. Detect / install the chosen tool(s)
 * 3. Install agent skills from the marketplace
 * 4. Print a success summary
 */
export async function onboardCommand(): Promise<void> {
  printBanner();

  const rl = createReadlineInterface();

  try {
    // Step 1: Provider selection
    const provider = await selectProvider(rl);

    // Step 2: Tool installation
    await ensureTools(rl, provider);

    // Step 3: Skills
    await ensureSkills();

    // Step 4: Summary
    printSummary();
  } finally {
    rl.close();
  }
}
