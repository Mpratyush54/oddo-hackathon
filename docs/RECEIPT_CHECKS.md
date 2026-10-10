# Receipt checking and finance explanations

The Express backend stays on AWS. Private receipts remain in S3; the backend sends their bytes to Azure Document Intelligence for invoice extraction. Create a Document Intelligence resource with **Free F0** pricing in Azure. A student subscription can be used if that resource is available. Do not select S0 or rely on student credits for paid OCR.

Fill `AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT` and `AZURE_DOCUMENT_INTELLIGENCE_KEY` in the ignored root `.env`. Keep `AZURE_DOCUMENT_INTELLIGENCE_TIER=F0`. The key stays server-side. Synchronize provider secrets using `node scripts/sync-provider-secrets.js` before deploying the code. API keys cannot reveal the actual resource pricing tier: verify that the Azure portal shows F0. The environment setting is a configuration guard, not independent billing verification.

F0 includes 500 pages monthly, accepts files up to 4 MB, and processes only two pages per request. The backend rejects PDFs longer than two pages and reserves at most 400 pages per UTC calendar month across all users and clubs, including failed or ambiguous attempts. Usage from Azure Studio or other applications on the same resource is outside this application counter. Azure throttling or exhausted allowance leaves submission blocked; there is no paid fallback. Use a dedicated F0 resource for this application.

## Reimbursement workflow

1. Upload one PDF, JPEG or PNG receipt and enter the claimed amount. The current browser upload limit is 2 MB.
2. Check the receipt. The backend freezes a separate copy, hashes its bytes and asks Azure's prebuilt invoice model for vendor, date, total, invoice reference and confidence.
3. A confident INR total matching the claim, readable vendor and valid receipt date can clear submission. Amount mismatches, low confidence, calculation inconsistencies and matching prior receipts are flagged.
4. A different club administrator must inspect a flagged receipt and record a clearance reason. Clearance is audited. It does not approve the expense or move money.
5. Submit the cleared receipt for expense review. The backend checks ownership, amount and status again. Submission consumes the receipt and duplicate-use keys atomically with the pending expense and audit.
6. A different administrator approves or rejects the expense. Only completed ledger entries affect the ledger balance. Approval records spending in the ledger; it does not execute a bank reimbursement.

Missing credentials, invalid documents or failed OCR never unlock submission. Historical pending expenses without completed receipt checks must be rejected and resubmitted through the new workflow before approval. Historical completed entries remain visible.

OCR confidence and consistency checks do not prove authenticity or establish fraud. Cleared means **eligible for submission**, with human review available for uncertain details.

## Finance explanation

Administrators and treasurers can request a summary of dues, ticket and merchandise income, other income, completed expenses, pending reviews and closing ledger balance. Monetary calculations come from the server ledger in integer paise. The optional free OpenRouter model receives aggregate totals only; it never receives member details or uploaded receipt bytes. If AI is unavailable, a labelled deterministic ledger explanation is returned. Test and simulated entries are identified as records that do not represent real money movement.

## Validation

Run `npm test` and `npm run build`. Receipt tests cover upload immutability, confidence/amount checks, ownership, manual clearance audit, duplicate consumption and provider failure. Azure adapter tests cover field normalization, unsafe endpoints, paid-tier configuration, oversized and multipage documents, and concurrent monthly usage reservations. These tests use injected providers; a real Azure test still requires an F0 resource endpoint and key.
