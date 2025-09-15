import { ScheduledMessageModel, MessageDeliveryLogModel } from '../../models/index.js';
import { AGENTMUX_CONSTANTS } from '../../constants.js';
export async function createScheduledMessage(req, res) {
    try {
        const { name, targetTeam, targetProject, message, delayAmount, delayUnit, isRecurring } = req.body;
        if (!name || !targetTeam || !message || !delayAmount || !delayUnit) {
            res.status(400).json({
                success: false,
                error: 'Missing required fields: name, targetTeam, message, delayAmount, and delayUnit',
            });
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
        });
    }
    catch (error) {
        console.error('Error creating scheduled message:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create scheduled message',
        });
    }
}
export async function getScheduledMessages(req, res) {
    try {
        const scheduledMessages = await this.storageService.getScheduledMessages();
        res.json({ success: true, data: scheduledMessages });
    }
    catch (error) {
        console.error('Error getting scheduled messages:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get scheduled messages',
        });
    }
}
export async function getScheduledMessage(req, res) {
    try {
        const { id } = req.params;
        const scheduledMessage = await this.storageService.getScheduledMessage(id);
        if (!scheduledMessage) {
            res.status(404).json({
                success: false,
                error: 'Scheduled message not found',
            });
            return;
        }
        res.json({ success: true, data: scheduledMessage });
    }
    catch (error) {
        console.error('Error getting scheduled message:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get scheduled message',
        });
    }
}
export async function updateScheduledMessage(req, res) {
    try {
        const { id } = req.params;
        const { name, targetTeam, targetProject, message, delayAmount, delayUnit, isRecurring, isActive, } = req.body;
        const existingMessage = await this.storageService.getScheduledMessage(id);
        if (!existingMessage) {
            res.status(404).json({
                success: false,
                error: 'Scheduled message not found',
            });
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
        });
    }
    catch (error) {
        console.error('Error updating scheduled message:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update scheduled message',
        });
    }
}
export async function deleteScheduledMessage(req, res) {
    try {
        const { id } = req.params;
        const deleted = await this.storageService.deleteScheduledMessage(id);
        if (!deleted) {
            res.status(404).json({
                success: false,
                error: 'Scheduled message not found',
            });
            return;
        }
        this.messageSchedulerService?.cancelMessage(id);
        res.json({
            success: true,
            message: 'Scheduled message deleted successfully',
        });
    }
    catch (error) {
        console.error('Error deleting scheduled message:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete scheduled message',
        });
    }
}
export async function toggleScheduledMessage(req, res) {
    try {
        const { id } = req.params;
        const { isActive } = req.body;
        const existingMessage = await this.storageService.getScheduledMessage(id);
        if (!existingMessage) {
            res.status(404).json({
                success: false,
                error: 'Scheduled message not found',
            });
            return;
        }
        const updatedMessage = ScheduledMessageModel.update(existingMessage, {
            isActive: isActive !== undefined ? isActive : !existingMessage.isActive,
        });
        await this.storageService.saveScheduledMessage(updatedMessage);
        if (updatedMessage.isActive)
            this.messageSchedulerService?.scheduleMessage(updatedMessage);
        else
            this.messageSchedulerService?.cancelMessage(id);
        res.json({
            success: true,
            data: updatedMessage,
            message: `Scheduled message ${updatedMessage.isActive ? 'activated' : 'deactivated'}`,
        });
    }
    catch (error) {
        console.error('Error toggling scheduled message:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to toggle scheduled message',
        });
    }
}
export async function runScheduledMessage(req, res) {
    try {
        const { id } = req.params;
        const scheduledMessage = await this.storageService.getScheduledMessage(id);
        if (!scheduledMessage) {
            res.status(404).json({
                success: false,
                error: 'Scheduled message not found',
            });
            return;
        }
        let success = false;
        let error;
        try {
            const sessionName = scheduledMessage.targetTeam === 'orchestrator'
                ? AGENTMUX_CONSTANTS.SESSIONS.ORCHESTRATOR_NAME
                : scheduledMessage.targetTeam;
            await this.tmuxService.sendMessage(sessionName, scheduledMessage.message);
            success = true;
        }
        catch (sendError) {
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
        const updatedMessage = ScheduledMessageModel.updateLastRun(scheduledMessage, new Date().toISOString());
        await this.storageService.saveScheduledMessage(updatedMessage);
        res.json({
            success: true,
            data: { delivered: success, deliveryLog },
            message: success
                ? 'Scheduled message sent successfully'
                : `Failed to send message: ${error}`,
        });
    }
    catch (error) {
        console.error('Error running scheduled message:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to run scheduled message',
        });
    }
}
//# sourceMappingURL=scheduled-messages.controller.js.map