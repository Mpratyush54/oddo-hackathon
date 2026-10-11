# Merchandise points

Club administrators and treasurers can open **Points & promos → Point rules** to enable redemption and set **Rupees discount per redeemed point**. The earning rules remain separate. Existing clubs start with redemption enabled at ₹1 per point until staff changes the rate. Rates support ₹0.01–₹1,000 in paise increments and are stored in `pointRules.redemptionValuePaise`.

At merchandise checkout, apply a coupon first, then enter a whole number of points and select **Apply points**. **Use maximum** fills the largest useful amount; Apply confirms it. The total shows both discounts. Points cover merchandise only, including member pricing when eligible; membership fees remain payable in cash. A fully covered merchandise purchase creates an order without a Razorpay charge.

Spendable points equal the member's earned participation, volunteer and contribution scores plus signed `redemption` ledger entries. Redemption preserves earned leaderboard scores. Points are checked against the authenticated buyer's server balance and recorded per item when the order commits. Opening or abandoning Razorpay checkout never spends points. The stock, ledger, order and verified payment commit together with the existing database version and idempotency checks. Competing paid checkouts that cannot fulfill are reconciled through the existing automatic refund flow.

Paid checkout snapshots the applied point count and conversion rate. If staff changes the rate while a payment is in progress, captured payment is refunded instead of silently spending a different number of points. New purchases use the new rule.

Confirmed processed refunds restore redeemed points once and reverse the contribution points earned from the refunded cash spend. Requested, rejected, failed or uncertain refunds do not restore them. Cancelling an uncollected order with no cash payment restores its points and stock; cancelled orders cannot be reopened. Cash contribution points are earned after both coupon and points discounts, excluding membership fees.

Whole points are capped at the remaining merchandise price; a remainder smaller than one point's value stays payable in cash. Request, ledger, order, payment and rule fields have Zod schemas. Run `npm test` for pricing, validation, payment retry, concurrent spending, free checkout, rate changes and refund checks.
