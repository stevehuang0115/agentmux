import { TeamMember } from '../types/index.js';
export interface ProjectContext {
    specifications: string;
    readme: string;
    structure: FileStructure[];
    tickets: string[];
    recentCommits: string[];
    dependencies: Record<string, string>;
}
export interface FileStructure {
    path: string;
    type: 'file' | 'directory';
    size?: number;
    lastModified: string;
}
export interface ContextLoadOptions {
    includeFiles?: boolean;
    includeGitHistory?: boolean;
    includeTickets?: boolean;
    maxFileSize?: number;
    fileExtensions?: string[];
}
export declare class ContextLoaderService {
    private projectPath;
    private agentmuxPath;
    constructor(projectPath: string);
    loadProjectContext(options?: ContextLoadOptions): Promise<ProjectContext>;
    private loadSpecifications;
    private loadReadme;
    private loadFileStructure;
    private traverseDirectory;
    private shouldIgnorePath;
    private loadTickets;
    private loadRecentCommits;
    private loadDependencies;
    generateContextPrompt(teamMember: TeamMember, options?: ContextLoadOptions): Promise<string>;
    injectContextIntoSession(sessionName: string, teamMember: TeamMember): Promise<boolean>;
    refreshContext(teamMember: TeamMember): Promise<string>;
}
//# sourceMappingURL=context-loader.service.d.ts.map