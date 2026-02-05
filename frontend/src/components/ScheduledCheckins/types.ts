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

/**
 * @deprecated Use dynamic team options from useScheduledMessages hook instead
 * This was previously a hardcoded list but now team options are loaded from the API
 */
export const TEAM_OPTIONS: TeamOption[] = [
  { value: 'orchestrator', label: 'Orchestrator' }
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