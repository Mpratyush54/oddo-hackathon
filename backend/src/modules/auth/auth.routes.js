export const createAuthRoutes = (controllers) => (app) => {
  app.post('/api/auth/signup', controllers.signup);
  app.post('/api/auth/login', controllers.login);
  app.post('/api/auth/refresh', controllers.refresh);
  app.get('/api/auth/me', controllers.me);
  app.post('/api/auth/logout', controllers.logout);
  app.post('/api/auth/password', controllers.changePassword);
};
