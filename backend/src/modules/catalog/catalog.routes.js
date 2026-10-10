export function registerCatalogRoutes(app, controller) {
  app.get('/api/health', controller.health);
  app.get('/api/public/clubs', controller.listPublicClubs);
}
