export function registerFinanceRoutes(app, controller) {
  app.post('/api/clubs/:clubId/receipts/upload', controller.createReceiptUpload);
  app.get('/api/clubs/:clubId/receipts/:transactionId', controller.downloadReceipt);
}
