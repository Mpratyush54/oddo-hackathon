export function registerCommunicationsRoutes(app, controller) {
  app.post('/api/ai/draft', controller.draftAnnouncement);
  app.post('/api/notifications/send', controller.sendNotification);
}
