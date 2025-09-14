import * as deliveryHandlers from '../../controllers/messaging/delivery-logs.controller.js';
export function registerDeliveryLogRoutes(router, apiController) {
    // Message Delivery Logs Routes
    router.get('/message-delivery-logs', (req, res) => deliveryHandlers.getDeliveryLogs.call(apiController, req, res));
    router.delete('/message-delivery-logs', (req, res) => deliveryHandlers.clearDeliveryLogs.call(apiController, req, res));
}
//# sourceMappingURL=delivery-logs.routes.js.map