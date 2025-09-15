import { v4 as uuidv4 } from 'uuid';
import { ScheduledMessage, MessageDeliveryLog } from '../types/index.js';

export class ScheduledMessageModel {
	static create(data: {
		name: string;
		targetTeam: string;
		targetProject?: string;
		message: string;
		delayAmount: number;
		delayUnit: 'seconds' | 'minutes' | 'hours';
		isRecurring: boolean;
		isActive?: boolean;
	}): ScheduledMessage {
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
			updatedAt: now,
		};
	}

	static update(
		existing: ScheduledMessage,
		updates: Partial<
			Pick<
				ScheduledMessage,
				| 'name'
				| 'targetTeam'
				| 'targetProject'
				| 'message'
				| 'delayAmount'
				| 'delayUnit'
				| 'isRecurring'
				| 'isActive'
			>
		>
	): ScheduledMessage {
		return {
			...existing,
			...updates,
			updatedAt: new Date().toISOString(),
		};
	}

	static updateLastRun(
		existing: ScheduledMessage,
		lastRun?: string,
		nextRun?: string
	): ScheduledMessage {
		return {
			...existing,
			lastRun,
			nextRun,
			updatedAt: new Date().toISOString(),
		};
	}
}

export class MessageDeliveryLogModel {
	static create(data: {
		scheduledMessageId: string;
		messageName: string;
		targetTeam: string;
		targetProject?: string;
		message: string;
		success: boolean;
		error?: string;
	}): MessageDeliveryLog {
		return {
			id: uuidv4(),
			scheduledMessageId: data.scheduledMessageId,
			messageName: data.messageName,
			targetTeam: data.targetTeam,
			targetProject: data.targetProject,
			message: data.message,
			sentAt: new Date().toISOString(),
			success: data.success,
			error: data.error,
		};
	}
}
