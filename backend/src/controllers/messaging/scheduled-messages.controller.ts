import { Request, Response } from 'express';
import type { ApiContext } from '../types.js';
import { ScheduledMessageModel, MessageDeliveryLogModel } from '../../models/index.js';
import { ApiResponse } from '../../types/index.js';
import { CREWLY_CONSTANTS } from '../../constants.js';

export async function createScheduledMessage(
	this: ApiContext,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const { name, targetTeam, targetProject, message, delayAmount, delayUnit, isRecurring } =
			req.body as any;
		if (!name || !targetTeam || !message || !delayAmount || !delayUnit) {
			res.status(400).json({
				success: false,
				error: 'Missing required fields: name, targetTeam, message, delayAmount, and delayUnit',
			} as ApiResponse);
			return;
		}
		const scheduledMessage = ScheduledMessageModel.create({
			name,
			targetTeam,
			targetProject,
			message,
			delayAmount: parseInt(delayAmount),
			delayUnit,
			isRecurring: isRecurring || false,
			isActive: true,
		});
		await this.storageService.saveScheduledMessage(scheduledMessage);
		this.messageSchedulerService?.scheduleMessage(scheduledMessage);
		res.json({
			success: true,
			data: scheduledMessage,
			message: 'Scheduled message created successfully',
		} as ApiResponse);
	} catch (error) {
		console.error('Error creating scheduled message:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to create scheduled message',
		} as ApiResponse);
	}
}

export async function getScheduledMessages(
	this: ApiContext,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const scheduledMessages = await this.storageService.getScheduledMessages();
		res.json({ success: true, data: scheduledMessages } as ApiResponse);
	} catch (error) {
		console.error('Error getting scheduled messages:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to get scheduled messages',
		} as ApiResponse);
	}
}

export async function getScheduledMessage(
	this: ApiContext,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const { id } = req.params as any;
		const scheduledMessage = await this.storageService.getScheduledMessage(id);
		if (!scheduledMessage) {
			res.status(404).json({
				success: false,
				error: 'Scheduled message not found',
			} as ApiResponse);
			return;
		}
		res.json({ success: true, data: scheduledMessage } as ApiResponse);
	} catch (error) {
		console.error('Error getting scheduled message:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to get scheduled message',
		} as ApiResponse);
	}
}

export async function updateScheduledMessage(
	this: ApiContext,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const { id } = req.params as any;
		const {
			name,
			targetTeam,
			targetProject,
			message,
			delayAmount,
			delayUnit,
			isRecurring,
			isActive,
		} = req.body as any;
		const existingMessage = await this.storageService.getScheduledMessage(id);
		if (!existingMessage) {
			res.status(404).json({
				success: false,
				error: 'Scheduled message not found',
			} as ApiResponse);
			return;
		}
		const updatedMessage = ScheduledMessageModel.update(existingMessage, {
			name,
			targetTeam,
			targetProject,
			message,
			delayAmount: delayAmount ? parseInt(delayAmount) : undefined,
			delayUnit,
			isRecurring,
			isActive,
		});
		await this.storageService.saveScheduledMessage(updatedMessage);
		this.messageSchedulerService?.scheduleMessage(updatedMessage);
		res.json({
			success: true,
			data: updatedMessage,
			message: 'Scheduled message updated successfully',
		} as ApiResponse);
	} catch (error) {
		console.error('Error updating scheduled message:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to update scheduled message',
		} as ApiResponse);
	}
}

export async function deleteScheduledMessage(
	this: ApiContext,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const { id } = req.params as any;
		const deleted = await this.storageService.deleteScheduledMessage(id);
		if (!deleted) {
			res.status(404).json({
				success: false,
				error: 'Scheduled message not found',
			} as ApiResponse);
			return;
		}
		this.messageSchedulerService?.cancelMessage(id);
		res.json({
			success: true,
			message: 'Scheduled message deleted successfully',
		} as ApiResponse);
	} catch (error) {
		console.error('Error deleting scheduled message:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to delete scheduled message',
		} as ApiResponse);
	}
}

export async function toggleScheduledMessage(
	this: ApiContext,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const { id } = req.params as any;
		const { isActive } = req.body as any;
		const existingMessage = await this.storageService.getScheduledMessage(id);
		if (!existingMessage) {
			res.status(404).json({
				success: false,
				error: 'Scheduled message not found',
			} as ApiResponse);
			return;
		}
		const updatedMessage = ScheduledMessageModel.update(existingMessage, {
			isActive: isActive !== undefined ? isActive : !existingMessage.isActive,
		});
		await this.storageService.saveScheduledMessage(updatedMessage);
		if (updatedMessage.isActive) this.messageSchedulerService?.scheduleMessage(updatedMessage);
		else this.messageSchedulerService?.cancelMessage(id);
		res.json({
			success: true,
			data: updatedMessage,
			message: `Scheduled message ${updatedMessage.isActive ? 'activated' : 'deactivated'}`,
		} as ApiResponse);
	} catch (error) {
		console.error('Error toggling scheduled message:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to toggle scheduled message',
		} as ApiResponse);
	}
}

export async function runScheduledMessage(
	this: ApiContext,
	req: Request,
	res: Response
): Promise<void> {
	try {
		const { id } = req.params as any;
		const scheduledMessage = await this.storageService.getScheduledMessage(id);
		if (!scheduledMessage) {
			res.status(404).json({
				success: false,
				error: 'Scheduled message not found',
			} as ApiResponse);
			return;
		}
		let success = false;
		let error: string | undefined;
		try {
			const sessionName =
				scheduledMessage.targetTeam === 'orchestrator'
					? CREWLY_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME
					: scheduledMessage.targetTeam;
			await this.tmuxService.sendMessage(sessionName, scheduledMessage.message);
			success = true;
		} catch (sendError: any) {
			success = false;
			error = sendError?.message || 'Failed to send message';
			console.error('Error sending message to session:', sendError);
		}
		const deliveryLog = MessageDeliveryLogModel.create({
			scheduledMessageId: scheduledMessage.id,
			messageName: scheduledMessage.name,
			targetTeam: scheduledMessage.targetTeam,
			targetProject: scheduledMessage.targetProject,
			message: scheduledMessage.message,
			success,
			error,
		});
		await this.storageService.saveDeliveryLog(deliveryLog);
		const updatedMessage = ScheduledMessageModel.updateLastRun(
			scheduledMessage,
			new Date().toISOString()
		);
		await this.storageService.saveScheduledMessage(updatedMessage);
		res.json({
			success: true,
			data: { delivered: success, deliveryLog },
			message: success
				? 'Scheduled message sent successfully'
				: `Failed to send message: ${error}`,
		} as ApiResponse);
	} catch (error) {
		console.error('Error running scheduled message:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to run scheduled message',
		} as ApiResponse);
	}
}
