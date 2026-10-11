# Demo data

`scripts/lib/demo-data.js` generates 200 fictional users and 200 new rows in each application collection **across the three clubs**: 67 Skyline, 67 CodeCraft, 66 Canvas. Existing records remain, so total counts can exceed 200. The dataset also includes 200 account profiles/accounts/access assignments, refund-history entries, payment placeholders and receipt-review records.

Names and IDs start with `Demo` / `DEMO-`; emails use the reserved `example.test` domain. Members have no phone numbers, no WhatsApp consent, and email/event/renewal/weekly preferences disabled. Passwords are generated from an unrecoverable random value and are never printed. No fake email verification or staff privileges are granted. Seeding does not call Meta, email, OpenRouter, Azure OCR or Razorpay.

Tickets, merchandise orders and finance rows are explicitly simulated. Payment placeholders are CreationFailed, and refund-history examples are Rejected with clear demo explanations. They do not claim a real provider charge/refund. Private sample PDFs are uploaded for receipt review and labeled **NOT A REAL INVOICE**; review rows say that OCR has not verified the synthetic document. Promo codes start with DEMO and are inactive.

The linked dataset includes full event waitlists, event reviews, tasks, point awards, announcements, personal notification records, in-app delivery history and audit entries. Notification ownership still applies; administrators do not receive other users' private notification messages. Existing messaging consent and real account data are preserved.

Run from the project root using an active owner AWS CLI login:

```sh
npm run seed:aws                # Read-only plan, counts and size checks
npm run seed:aws -- --apply      # Append records to the existing AWS workspace
```

The script checks every record with the runtime Zod schemas and rejects oversized club data before writing. Seeded club records stop at 350 KB, below the 370 KB application guard and DynamoDB 400 KB item limit. An ignored `.aws-build/demo-backup-*.json` stores the original club aggregates. Existing standalone demo records are inserted conditionally; aggregate writes use version checks. Re-running does not duplicate rows, overwrite edits or reset real records. GitHub deployments do not automatically reseed the database.

For an already populated workspace, use `npm run seed:aws -- --top-up` to preview a plan and add `--apply` to execute it. It adds only the history needed to reach at least 200 rows per collection across all three clubs, plus linked parent rows. Existing demo and real users remain intact. Projects are included. The original full seeding mode is intended for an empty workspace; it refuses oversized populated aggregates.

Authentication sessions, tokens, quota counters and provider delivery receipts are created by real actions, rather than fabricated to make their operational tables larger.
