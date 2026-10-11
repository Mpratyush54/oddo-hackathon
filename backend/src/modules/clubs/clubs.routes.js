export function registerClubsRoutes(app, controller) {
  app.get('/api/clubs/:clubId/state', controller.getState);
  app.get('/api/clubs/:clubId/tables/:table', controller.listTable);
  app.post('/api/clubs/:clubId/actions', controller.executeAction);
}
