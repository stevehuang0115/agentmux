import { v4 as uuidv4 } from 'uuid';
export class ScheduledMessageModel {
    static create(data) {
        const now = new Date().toISOString();
        return {
            id: uuidv4(),
            name: data.name,
            targetTeam: data.targetTeam,
            targetProject: data.targetProject,
            message: data.message,
            delayAmount: data.delayAmount,
            delayUnit: data.delayUnit,
            isRecurring: data.isRecurring,
            isActive: data.isActive !== false,
            createdAt: now,
            updatedAt: now
        };
    }
    static update(existing, updates) {
        return {
            ...existing,
            ...updates,
            updatedAt: new Date().toISOString()
        };
    }
    static updateLastRun(existing, lastRun, nextRun) {
        return {
            ...existing,
            lastRun,
            nextRun,
            updatedAt: new Date().toISOString()
        };
    }
}
export class MessageDeliveryLogModel {
    static create(data) {
        return {
            id: uuidv4(),
            scheduledMessageId: data.scheduledMessageId,
            messageName: data.messageName,
            targetTeam: data.targetTeam,
            targetProject: data.targetProject,
            message: data.message,
            sentAt: new Date().toISOString(),
            success: data.success,
            error: data.error
        };
    }
}
//# sourceMappingURL=ScheduledMessage.js.map