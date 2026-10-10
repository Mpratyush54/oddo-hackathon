export function registerCollegeRoutes(app, controller) {
  app.get('/api/college/overview', controller.overview);
}
