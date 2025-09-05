import { FSWatcher } from 'fs';
import { Team, Project, Ticket, TicketFilter, ScheduledMessage, MessageDeliveryLog } from '../types/index.js';
export declare class StorageService {
    private agentmuxHome;
    private teamsFile;
    private projectsFile;
    private runtimeFile;
    private scheduledMessagesFile;
    private deliveryLogsFile;
    constructor(agentmuxHome?: string);
    private ensureDirectories;
    private ensureFile;
    getTeams(): Promise<Team[]>;
    saveTeam(team: Team): Promise<void>;
    updateTeamStatus(id: string, status: Team['status']): Promise<void>;
    deleteTeam(id: string): Promise<void>;
    getProjects(): Promise<Project[]>;
    addProject(projectPath: string): Promise<Project>;
    saveProject(project: Project): Promise<void>;
    deleteProject(id: string): Promise<void>;
    getTickets(projectPath: string, filter?: TicketFilter): Promise<Ticket[]>;
    saveTicket(projectPath: string, ticket: Ticket): Promise<void>;
    deleteTicket(projectPath: string, ticketId: string): Promise<void>;
    private parseTicketYAML;
    watchProject(projectPath: string): FSWatcher;
    getRuntimeState(): Promise<any>;
    saveRuntimeState(state: any): Promise<void>;
    /**
     * Create template files for a new project
     */
    private createProjectTemplateFiles;
    getScheduledMessages(): Promise<ScheduledMessage[]>;
    saveScheduledMessage(scheduledMessage: ScheduledMessage): Promise<void>;
    getScheduledMessage(id: string): Promise<ScheduledMessage | undefined>;
    deleteScheduledMessage(id: string): Promise<boolean>;
    getDeliveryLogs(): Promise<MessageDeliveryLog[]>;
    saveDeliveryLog(log: MessageDeliveryLog): Promise<void>;
    clearDeliveryLogs(): Promise<void>;
}
//# sourceMappingURL=storage.service.d.ts.map