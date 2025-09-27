import type { 
  StorageService, 
  TmuxService, 
  SchedulerService, 
  MessageSchedulerService,
  ActiveProjectsService,
  PromptTemplateService,
  TaskAssignmentMonitorService,
  TaskTrackingService,
  AgentRegistrationService
} from '../services/index.js';

export interface ApiContext {
  storageService: StorageService;
  tmuxService: TmuxService;
  agentRegistrationService: AgentRegistrationService;
  schedulerService: SchedulerService;
  messageSchedulerService?: MessageSchedulerService;
  activeProjectsService: ActiveProjectsService;
  promptTemplateService: PromptTemplateService;
  taskAssignmentMonitor: TaskAssignmentMonitorService;
  taskTrackingService: TaskTrackingService;
  cleanupProjectScheduledMessages?: (projectId: string) => Promise<{
    found: number;
    cancelled: number;
    errors: string[];
  }>;
}

