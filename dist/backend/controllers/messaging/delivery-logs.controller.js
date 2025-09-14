export async function getDeliveryLogs(req, res) {
    try {
        const logs = await this.storageService.getDeliveryLogs();
        res.json({ success: true, data: logs, message: 'Delivery logs retrieved successfully' });
    }
    catch (error) {
        console.error('Error getting delivery logs:', error);
        res.status(500).json({ success: false, error: 'Failed to get delivery logs' });
    }
}
export async function clearDeliveryLogs(req, res) {
    try {
        await this.storageService.clearDeliveryLogs();
        res.json({ success: true, message: 'Delivery logs cleared successfully' });
    }
    catch (error) {
        console.error('Error clearing delivery logs:', error);
        res.status(500).json({ success: false, error: 'Failed to clear delivery logs' });
    }
}
//# sourceMappingURL=delivery-logs.controller.js.map