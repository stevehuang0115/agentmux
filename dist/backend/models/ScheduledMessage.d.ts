import { ScheduledMessage, MessageDeliveryLog } from '../types/index.js';
export declare class ScheduledMessageModel {
    static create(data: {
        name: string;
        targetTeam: string;
        targetProject?: string;
        message: string;
        delayAmount: number;
        delayUnit: 'seconds' | 'minutes' | 'hours';
        isRecurring: boolean;
        isActive?: boolean;
    }): ScheduledMessage;
    static update(existing: ScheduledMessage, updates: Partial<Pick<ScheduledMessage, 'name' | 'targetTeam' | 'targetProject' | 'message' | 'delayAmount' | 'delayUnit' | 'isRecurring' | 'isActive'>>): ScheduledMessage;
    static updateLastRun(existing: ScheduledMessage, lastRun?: string, nextRun?: string): ScheduledMessage;
}
export declare class MessageDeliveryLogModel {
    static create(data: {
        scheduledMessageId: string;
        messageName: string;
        targetTeam: string;
        targetProject?: string;
        message: string;
        success: boolean;
        error?: string;
    }): MessageDeliveryLog;
}
//# sourceMappingURL=ScheduledMessage.d.ts.map