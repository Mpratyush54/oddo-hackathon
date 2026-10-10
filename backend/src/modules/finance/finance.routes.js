export function registerFinanceRoutes(app, controller) {
  app.post('/api/clubs/:clubId/receipts/check', controller.startReceiptCheck);
  app.get('/api/clubs/:clubId/receipts/checks', controller.receiptReviewQueue);
  app.get('/api/clubs/:clubId/receipts/checks/:receiptId', controller.receiptCheckStatus);
  app.get('/api/clubs/:clubId/receipts/checks/:receiptId/file', controller.checkedReceiptFile);
  app.post('/api/clubs/:clubId/receipts/checks/:receiptId/clear', controller.clearReceipt);
  app.post('/api/clubs/:clubId/finance/explain', controller.explainLedger);
  app.post('/api/clubs/:clubId/receipts/upload', controller.createReceiptUpload);
  app.get('/api/clubs/:clubId/receipts/:transactionId', controller.downloadReceipt);
}
