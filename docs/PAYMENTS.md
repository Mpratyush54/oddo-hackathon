# Razorpay test payments

Tickets, merchandise (including membership bundles), and annual membership use Razorpay Standard Checkout in the AWS app. Local demo mode retains its offline simulator. Live Razorpay keys are rejected by the backend.

Set `RAZORPAY_KEY_ID` (`rzp_test_...`), `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in the ignored root `.env`. The webhook secret is a separate random secret you choose; enter the identical value in Razorpay's Test-mode webhook configuration. Never put the secrets in frontend environment variables. Run `node scripts/sync-provider-secrets.js` with an active owner AWS session, then deploy code to reload the Lambda secret cache.

Webhook URL: https://f23vxl3ad5.execute-api.ap-south-1.amazonaws.com/api/webhooks/razorpay

Subscribe to `payment.captured`, `order.paid`, `refund.created`, `refund.processed`, and `refund.failed`. Configure automatic payment capture in Razorpay. Authorized payments remain pending and issue no purchase. All amounts are server-calculated INR paise; free tickets bypass the provider.

Active, unexpired club membership applies the club's member price to every subsequent ticket and merchandise purchase. Administrator approval with a dues waiver grants the same pricing as a paid membership. An existing active member is not charged the joining fee again when a merchandise bundle is selected. The browser and backend share `shared/membership.js`; pending, expired, or refund-suspended membership is ineligible.

## Routes and storage

- `POST /api/payments/orders`: authenticated, CSRF-protected `{ clubId, action, idempotencyKey }`. Accepted actions are tickets, orders, and the existing membership dues action. The server creates an order and returns the public test key and order details.
- `POST /api/payments/verify`: authenticated callback with the request key and Razorpay payment/order/signature. The server verifies HMAC using its stored order ID and fetches the payment from Razorpay to check captured status, amount, currency, order and refund amount.
- `GET /api/payments/:key`: checks only the current user's attempt, recovers captured payments when a browser callback was lost, and returns the current club view after fulfillment.
- `POST /api/webhooks/razorpay`: verifies the original raw bytes with the webhook secret. Capture events fetch provider payment details and run the same fulfillment path.

`USER#userId / PAYMENT#requestKey` records retain the quote, action, provider IDs, test mode, version, status and fulfillment result. `RAZORPAY#orderId / PAYMENT_REF` maps signed webhooks to the owner. These financial records have no TTL. Fulfillment commits the payment status and club state, ledger, audit and business request atomically. Browser retries and webhook duplicates cannot issue another purchase. New tickets, orders and ledger entries have a `paymentId`; test entries continue to be marked simulated because no real funds move.

## Availability and refunds

Inventory and seats are rechecked after capture; creating a provider order does not reserve them. If price or availability changes, the server claims and requests a full test refund instead of issuing the purchase. Members can track automatic and requested refunds at `/app/refunds`. Interrupted provider order creation stays `Creating`; contact an administrator before starting another checkout attempt.

Members request a refund from My tickets, My orders, Membership card or Refunds and provide a reason. Club administrators and treasurers approve or reject requests inside Refunds; rejection requires an explanation. Refund amounts come from the original verified payment and return through Razorpay to its original payment method. This version supports full payment refunds only: all quantities and membership in one bundle are refunded together. Checked-in tickets, ended events and picked-up merchandise are ineligible. A membership refund requires resolving its other active member purchases first.

Approval locks affected purchases against check-in, cancellation and pickup, and suspends the included membership. Only provider-confirmed `processed` refunds cancel purchases, release inventory/seats, reverse contribution points, restore the previous membership and record a negative ledger entry. Failed refunds release the locks and restore membership. Unknown results remain pending; Check status fetches the existing provider refund or retries the identical payload with the saved `X-Refund-Idempotency` key. A new key is used only after a confirmed failure. Signed refund webhooks fetch provider truth and share the same atomic reconciliation path, preventing duplicate credits. Check status works even before the owner subscribes to the new webhook events.

`GET/POST /api/clubs/:clubId/refunds` list permitted requests and submit an owned payment. `POST /api/clubs/:clubId/refunds/:paymentId/review` accepts approve/reject, and `/refresh` reconciles provider status. JWT, CSRF on mutations, ownership and current club roles protect these routes. Club-scoped `REFUND#paymentId` records persist status, reason, provider reference, audit information and membership lock snapshots without TTL.

Older automatic refunds can be imported by matching their legacy provider receipt; an unconfirmed older attempt is never blindly resent. Refunds issued externally in the Razorpay dashboard without an app request are not automatically reconciled. Use the app for managed refunds. Administrator membership activation remains an explicit dues waiver with no invented payment.

The browser retains an unfinished request key for the same user, club and selection in session storage. Retrying that checkout checks its status before opening Razorpay again.

Reference: [Standard Checkout integration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/), [webhook validation](https://razorpay.com/docs/webhooks/validate-test/), [idempotent refunds](https://razorpay.com/docs/api/refunds/normal-refunds-idempotent/), [refund webhooks](https://razorpay.com/docs/webhooks/refunds/).
