export interface ScheduledMessage {
  id: string;
  name: string;
  targetTeam: string;
  targetProject?: string;
  message: string;
  delayAmount: number;
  delayUnit: 'seconds' | 'minutes' | 'hours';
  isRecurring: boolean;
  isActive: boolean;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledMessageFormData {
  name: string;
  targetTeam: string;
  targetProject: string;
  message: string;
  delayAmount: string;
  delayUnit: 'seconds' | 'minutes' | 'hours';
  isRecurring: boolean;
}

export interface MessageDeliveryLog {
  id: string;
  scheduledMessageId: string;
  messageName: string;
  targetTeam: string;
  targetProject?: string;
  message: string;
  sentAt: string;
  success: boolean;
  error?: string;
}

export type ActiveTab = 'active' | 'completed';

export interface TeamOption {
  value: string;
  label: string;
}

export const TEAM_OPTIONS: TeamOption[] = [
  { value: 'orchestrator', label: 'Orchestrator' },
  { value: 'frontend-team-pm', label: 'Frontend Team PM' },
  { value: 'frontend-team-dev', label: 'Frontend Team Dev' },
  { value: 'backend-team-pm', label: 'Backend Team PM' },
  { value: 'backend-team-dev', label: 'Backend Team Dev' },
  { value: 'backend-team-qa', label: 'Backend Team QA' }
];

export const DEFAULT_FORM_DATA: ScheduledMessageFormData = {
  name: '',
  targetTeam: 'orchestrator',
  targetProject: '',
  message: '',
  delayAmount: '5',
  delayUnit: 'minutes',
  isRecurring: false
};