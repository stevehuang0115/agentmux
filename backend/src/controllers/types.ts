import type { StorageService, TmuxService, SchedulerService, MessageSchedulerService } from '../services/index.js';
import type { ActiveProjectsService } from '../services/active-projects.service.js';
import type { PromptTemplateService } from '../services/prompt-template.service.js';
import type { TaskAssignmentMonitorService } from '../services/task-assignment-monitor.service.js';

export interface ApiContext {
  storageService: StorageService;
  tmuxService: TmuxService;
  schedulerService: SchedulerService;
  messageSchedulerService?: MessageSchedulerService;
  activeProjectsService: ActiveProjectsService;
  promptTemplateService: PromptTemplateService;
  taskAssignmentMonitor: TaskAssignmentMonitorService;
}

