export function registerClubsRoutes(app, controller) {
  app.get('/api/clubs/:clubId/state', controller.getState);
  app.post('/api/clubs/:clubId/actions', controller.executeAction);
}
