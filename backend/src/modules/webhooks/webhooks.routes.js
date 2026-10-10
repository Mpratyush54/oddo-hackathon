export function registerWebhooksRoutes(app, controller) {
  app.get('/api/webhooks/whatsapp', controller.verifySubscription);
  app.post('/api/webhooks/whatsapp', controller.receiveStatus);
}
