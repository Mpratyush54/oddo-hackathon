export function registerCommerceRoutes(app, controller) {
  app.post('/api/promos/quote', controller.quotePromo);
  const aliases = {
    '/orders': 'orders',
    '/inventory': 'inventory',
    '/products': 'products.create',
    '/tickets/cancel': 'tickets.cancel',
    '/waitlist/join': 'waitlist.join',
    '/points/award': 'points.award',
    '/points/rules': 'points.rules',
    '/check-in': 'check-in',
    '/tickets/book': 'tickets.book',
  };
  for (const [path, type] of Object.entries(aliases))
    app.post(`/api${path}`, controller.executeCommerce(type));
}
