# Razorpay test payments

Tickets, merchandise (including membership bundles), and annual membership use Razorpay Standard Checkout in the AWS app. Local demo mode retains its offline simulator. Live Razorpay keys are rejected by the backend.

Set `RAZORPAY_KEY_ID` (`rzp_test_...`), `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in the ignored root `.env`. The webhook secret is a separate random secret you choose; enter the identical value in Razorpay's Test-mode webhook configuration. Never put the secrets in frontend environment variables. Run `node scripts/sync-provider-secrets.js` with an active owner AWS session, then deploy code to reload the Lambda secret cache.

Webhook URL: https://f23vxl3ad5.execute-api.ap-south-1.amazonaws.com/api/webhooks/razorpay

Subscribe to `payment.captured` and `order.paid`. Configure automatic payment capture in Razorpay. Authorized payments remain pending and issue no purchase. All amounts are server-calculated INR paise; free tickets bypass the provider.

## Routes and storage

- `POST /api/payments/orders`: authenticated, CSRF-protected `{ clubId, action, idempotencyKey }`. Accepted actions are tickets, orders, and the existing membership dues action. The server creates an order and returns the public test key and order details.
- `POST /api/payments/verify`: authenticated callback with the request key and Razorpay payment/order/signature. The server verifies HMAC using its stored order ID and fetches the payment from Razorpay to check captured status, amount, currency, order and refund amount.
- `GET /api/payments/:key`: checks only the current user's attempt, recovers captured payments when a browser callback was lost, and returns the current club view after fulfillment.
- `POST /api/webhooks/razorpay`: verifies the original raw bytes with the webhook secret. Capture events fetch provider payment details and run the same fulfillment path.

`USER#userId / PAYMENT#requestKey` records retain the quote, action, provider IDs, test mode, version, status and fulfillment result. `RAZORPAY#orderId / PAYMENT_REF` maps signed webhooks to the owner. These financial records have no TTL. Fulfillment commits the payment status and club state, ledger, audit and business request atomically. Browser retries and webhook duplicates cannot issue another purchase. New tickets, orders and ledger entries have a `paymentId`; test entries continue to be marked simulated because no real funds move.

## Availability and refunds

Inventory and seats are rechecked after capture; creating a provider order does not reserve them. If price or availability changes, the server claims and requests a full test refund instead of issuing the purchase. If a refund request has an ambiguous network result, it stays `RefundPending` and is not automatically resent. An administrator must reconcile that attempt in the Razorpay Test dashboard using its payment ID. Interrupted provider order creation stays `Creating`; contact an administrator before starting another attempt.

Cancellation of an already fulfilled Razorpay purchase is blocked in the existing simulator cancellation routes. Manage its refund in the Razorpay Test dashboard; automated cancellation reconciliation is outside this integration. Dashboard refunds after fulfillment do not automatically revoke tickets/membership or restore inventory. Administrator membership activation through Users & access remains an explicit dues waiver with no invented payment.

The browser retains an unfinished request key for the same user, club and selection in session storage. Retrying that checkout checks its status before opening Razorpay again.

Reference: [Standard Checkout integration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/), [webhook validation](https://razorpay.com/docs/webhooks/validate-test/), [refund API](https://razorpay.com/docs/api/refunds/create-normal/).
