import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync } from 'fs';
import { parse as parseYAML } from 'yaml';
export class ContextLoaderService {
    projectPath;
    agentmuxPath;
    constructor(projectPath) {
        this.projectPath = path.resolve(projectPath);
        this.agentmuxPath = path.join(this.projectPath, '.agentmux');
    }
    async loadProjectContext(options = {}) {
        const defaultOptions = {
            includeFiles: true,
            includeGitHistory: true,
            includeTickets: true,
            maxFileSize: 1024 * 1024, // 1MB
            fileExtensions: ['.ts', '.tsx', '.js', '.jsx', '.md', '.json', '.yaml', '.yml', '.txt']
        };
        const opts = { ...defaultOptions, ...options };
        const [specifications, readme, structure, tickets, recentCommits, dependencies] = await Promise.all([
            this.loadSpecifications(),
            this.loadReadme(),
            opts.includeFiles ? this.loadFileStructure(opts) : Promise.resolve([]),
            opts.includeTickets ? this.loadTickets() : Promise.resolve([]),
            opts.includeGitHistory ? this.loadRecentCommits() : Promise.resolve([]),
            this.loadDependencies()
        ]);
        return {
            specifications,
            readme,
            structure,
            tickets,
            recentCommits,
            dependencies
        };
    }
    async loadSpecifications() {
        const specFiles = [
            'project.md',
            'architecture.md',
            'requirements.md',
            'prd.md',
            'specs.md'
        ];
        let specifications = '';
        for (const specFile of specFiles) {
            const specPath = path.join(this.agentmuxPath, specFile);
            if (existsSync(specPath)) {
                try {
                    const content = await fs.readFile(specPath, 'utf-8');
                    specifications += `\n\n## ${specFile}\n\n${content}`;
                }
                catch (error) {
                    console.error(`Error reading spec file ${specFile}:`, error);
                }
            }
        }
        return specifications.trim();
    }
    async loadReadme() {
        const readmePaths = [
            path.join(this.projectPath, 'README.md'),
            path.join(this.projectPath, 'readme.md'),
            path.join(this.projectPath, 'README.txt')
        ];
        for (const readmePath of readmePaths) {
            if (existsSync(readmePath)) {
                try {
                    return await fs.readFile(readmePath, 'utf-8');
                }
                catch (error) {
                    console.error(`Error reading README at ${readmePath}:`, error);
                }
            }
        }
        return '';
    }
    async loadFileStructure(options) {
        const structure = [];
        try {
            await this.traverseDirectory(this.projectPath, structure, options);
        }
        catch (error) {
            console.error('Error loading file structure:', error);
        }
        return structure;
    }
    async traverseDirectory(dirPath, structure, options, depth = 0) {
        if (depth > 10)
            return; // Prevent infinite recursion
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry?.name)
                continue;
            const fullPath = path.join(dirPath, entry.name);
            const relativePath = path.relative(this.projectPath, fullPath);
            // Skip node_modules, .git, and other common ignore patterns
            if (this.shouldIgnorePath(relativePath))
                continue;
            if (entry.isDirectory()) {
                structure.push({
                    path: relativePath,
                    type: 'directory',
                    lastModified: (await fs.stat(fullPath)).mtime.toISOString()
                });
                await this.traverseDirectory(fullPath, structure, options, depth + 1);
            }
            else if (entry.isFile()) {
                const stats = await fs.stat(fullPath);
                const extension = path.extname(entry.name);
                // Filter by file extension if specified
                if (options.fileExtensions && !options.fileExtensions.includes(extension)) {
                    continue;
                }
                // Skip files that are too large
                if (options.maxFileSize && stats.size > options.maxFileSize) {
                    continue;
                }
                structure.push({
                    path: relativePath,
                    type: 'file',
                    size: stats.size,
                    lastModified: stats.mtime.toISOString()
                });
            }
        }
    }
    shouldIgnorePath(relativePath) {
        const ignorePatternsRegex = [
            /node_modules/,
            /\.git/,
            /\.DS_Store/,
            /\.vscode/,
            /\.idea/,
            /dist/,
            /build/,
            /coverage/,
            /\.next/,
            /\.nuxt/,
            /logs/,
            /tmp/,
            /temp/,
            /.*\.log$/,
            /.*\.tmp$/
        ];
        return ignorePatternsRegex.some(pattern => pattern.test(relativePath));
    }
    async loadTickets() {
        const ticketsPath = path.join(this.agentmuxPath, 'tasks');
        if (!existsSync(ticketsPath)) {
            return [];
        }
        try {
            const ticketFiles = await fs.readdir(ticketsPath);
            const yamlFiles = ticketFiles.filter(file => {
                const fileName = typeof file === 'string' ? file : file?.name || '';
                return fileName.endsWith('.yaml');
            }).map(file => typeof file === 'string' ? file : file?.name || '');
            const tickets = [];
            for (const file of yamlFiles) {
                const filePath = path.join(ticketsPath, file);
                try {
                    const content = await fs.readFile(filePath, 'utf-8');
                    const ticket = parseYAML(content);
                    tickets.push(`## ${ticket.title}\n**Status:** ${ticket.status}\n**Priority:** ${ticket.priority}\n**Assigned to:** ${ticket.assignedTo || 'Unassigned'}\n\n${ticket.description}`);
                }
                catch (error) {
                    console.error(`Error reading ticket ${file}:`, error);
                }
            }
            return tickets;
        }
        catch (error) {
            console.error('Error loading tickets:', error);
            return [];
        }
    }
    async loadRecentCommits() {
        try {
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execAsync = promisify(exec);
            const { stdout } = await execAsync('git log --oneline -10', { cwd: this.projectPath });
            return stdout.trim().split('\n').filter(line => line.length > 0);
        }
        catch (error) {
            // Not a git repository or git not available
            return [];
        }
    }
    async loadDependencies() {
        const packageJsonPath = path.join(this.projectPath, 'package.json');
        if (!existsSync(packageJsonPath)) {
            return {};
        }
        try {
            const packageContent = await fs.readFile(packageJsonPath, 'utf-8');
            const packageJson = JSON.parse(packageContent);
            return {
                ...packageJson.dependencies || {},
                ...packageJson.devDependencies || {}
            };
        }
        catch (error) {
            console.error('Error loading dependencies:', error);
            return {};
        }
    }
    async generateContextPrompt(teamMember, options) {
        const context = await this.loadProjectContext(options);
        let prompt = `# Project Context for ${teamMember.name} (${teamMember.role})\n\n`;
        // Add role-specific system prompt
        prompt += `## Your Role\n${teamMember.systemPrompt}\n\n`;
        // Add project specifications
        if (context.specifications) {
            prompt += `## Project Specifications\n${context.specifications}\n\n`;
        }
        // Add README
        if (context.readme) {
            prompt += `## Project README\n${context.readme}\n\n`;
        }
        // Add current tickets relevant to this team member
        const relevantTickets = context.tickets.filter(ticket => ticket.toLowerCase().includes(teamMember.name.toLowerCase()) ||
            ticket.toLowerCase().includes('unassigned'));
        if (relevantTickets.length > 0) {
            prompt += `## Relevant Tickets\n${relevantTickets.join('\n\n')}\n\n`;
        }
        // Add file structure (condensed for readability)
        if (context.structure.length > 0) {
            prompt += `## Project Structure\n`;
            const directories = context.structure.filter(f => f.type === 'directory').slice(0, 20);
            const files = context.structure.filter(f => f.type === 'file').slice(0, 50);
            directories.forEach(dir => {
                prompt += `📁 ${dir.path}/\n`;
            });
            files.forEach(file => {
                prompt += `📄 ${file.path}\n`;
            });
            prompt += '\n';
        }
        // Add recent git history
        if (context.recentCommits.length > 0) {
            prompt += `## Recent Commits\n${context.recentCommits.slice(0, 5).join('\n')}\n\n`;
        }
        // Add key dependencies
        if (Object.keys(context.dependencies).length > 0) {
            prompt += `## Key Dependencies\n`;
            Object.entries(context.dependencies).slice(0, 10).forEach(([name, version]) => {
                prompt += `- ${name}: ${version}\n`;
            });
            prompt += '\n';
        }
        prompt += `## Instructions\nYou are now working on this project. Use the context above to understand your role and the current state of the project. Focus on the tickets assigned to you and collaborate with other team members as needed.\n`;
        return prompt;
    }
    async injectContextIntoSession(sessionName, teamMember, tmuxService) {
        try {
            const contextPrompt = await this.generateContextPrompt(teamMember);
            // Save context to a file that can be referenced by the agent
            const contextPath = path.join(this.agentmuxPath, 'context', `${teamMember.id}-context.md`);
            const contextDir = path.dirname(contextPath);
            if (!existsSync(contextDir)) {
                await fs.mkdir(contextDir, { recursive: true });
            }
            await fs.writeFile(contextPath, contextPrompt, 'utf-8');
            // Send context loading command to tmux session using service layer if available
            if (tmuxService && typeof tmuxService.sendMessage === 'function') {
                // Use robust tmux service approach
                const message = `echo 'Project context loaded at ${contextPath}'`;
                await tmuxService.sendMessage(sessionName, message);
            }
            else {
                // Fallback to robust script approach
                const { spawn } = await import('child_process');
                const { promisify } = await import('util');
                const scriptPath = path.resolve(__dirname, '../../../config/runtime_scripts/tmux_robosend.sh');
                await new Promise((resolve, reject) => {
                    const process = spawn('bash', [scriptPath, sessionName, `echo 'Project context loaded at ${contextPath}'`]);
                    process.on('close', (code) => {
                        if (code === 0)
                            resolve();
                        else
                            reject(new Error(`tmux_robosend.sh exited with code ${code}`));
                    });
                    process.on('error', reject);
                });
            }
            return true;
        }
        catch (error) {
            console.error(`Error injecting context into session ${sessionName}:`, error);
            return false;
        }
    }
    async refreshContext(teamMember) {
        const contextPath = path.join(this.agentmuxPath, 'context', `${teamMember.id}-context.md`);
        if (existsSync(contextPath)) {
            // Update existing context
            const updatedPrompt = await this.generateContextPrompt(teamMember);
            await fs.writeFile(contextPath, updatedPrompt, 'utf-8');
            return contextPath;
        }
        else {
            // Create new context
            await this.injectContextIntoSession(teamMember.sessionName, teamMember);
            return contextPath;
        }
    }
}
//# sourceMappingURL=context-loader.service.js.map