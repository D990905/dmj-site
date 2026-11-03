# Private supplier order management

Entry: `/admin/supplier-orders.html`, linked from the existing operations navigation.

This is supplier purchasing, separate from customer sales orders and inventory. All UI and exports are English. Source records live only in the database; never put source screenshots, imported costs, recipient addresses, or seeded order data in the public repository.

## Data and access

`ops_supplier_lists` and `ops_supplier_items` use RLS with the existing `is_ops_admin()` predicate. Anonymous access is revoked. Authenticated users receive table privileges only through the admin RLS policies; no role membership, API key, external origin, or public sharing route is added. Trigger functions are SECURITY INVOKER. There is no public export endpoint: each export revalidates the administrator and reads the protected tables.

Every item and list has a revision. Updates compare the previously read revision; server triggers require an increment. Item edits lock and increment the parent list revision. Exports compare parent revisions before/after the complete paginated read and refuse partial or changing lists. Ready lists reject edits until reopened; completing a list requires explicit quantities and currency for known amounts. Records are cancelled rather than deleted. Completion never places an order or changes inventory.

Already-paid amounts are row totals, not unit prices, and are kept separate from additional-order unit costs and calculated new-order amounts. Missing values remain NULL. No currency conversion or inferred quantity is applied. Import source keys are unique to avoid duplicate imports. Screenshot retail prices are not treated as supplier costs.

## Downloads and email

Both downloads include all saved rows, regardless of the on-screen filter. Excel uses native XLSX with two worksheets, frozen headings, explicit numeric/blank cells, and inline text cells (no formula injection). PDF is generated locally with English text and multipage rows. Neither file is uploaded or exposed by a public link.

Email preview shows the full saved list and exact recipient. An explicit checkbox and button are required. No site-side email sending service was configured. The button opens the user's email app; long lists are copied for manual pasting because mailto URLs have practical length limits. Excel/PDF files must be attached manually. Actual automatic email delivery with attachments remains unimplemented until the owner authorizes/configures a sender and delivery service. The site never reports an email as sent. No real email was sent during development.

## Verification

- Existing-admin create/edit, optimistic stale-update rejection, completion validation, ready-list lock, reopening, and paid-value preservation: live database transaction tests, rolled back.
- Anonymous reads/writes rejected; ordinary authenticated users see no rows and cannot insert: live RLS tests, rolled back.
- XLSX reopened with openpyxl to verify exact known amounts, unknowns, separate new-order calculations, text cells, and styles.
- PDF reopened with pypdf and rendered with PyMuPDF to inspect layout and long-note continuation.
- `node tests/supplier-export.cjs` exercises the export matrix, amounts, unknowns, escaping, multipage notes, and unsupported text errors.
- Existing outlet/auth, consent/ingestion tests, and product gallery checker must remain green.

UI security also checks account changes, page restoration, and visibility changes. Unsaved edits survive switching tabs only while the same administrator is reverified; changing accounts clears private state. Exported files remain private information on the user's own device and are not revoked by later sign-out.

## Korean UI / English exports

The administrator UI, status labels, fixed instructions, and known source-note labels are Korean. Stored product names, original English notes, and enum values are preserved. Excel, PDF, and email use the original English data only. Korean free-text notes have a separate `notes_ko` field; the matching English `notes` must be explicitly reviewed via `notes_english_confirmed`. Changing either note in the UI resets the review checkbox. Unreviewed Korean notes block all three export/share formats; no translation service or guessed translation is used. Proper model names remain unchanged. New list names and export subjects require English input.

`node tests/supplier-localization.cjs` verifies UI labels, fixed status mapping, English-only exports, original model names, and review gating. Native XLSX/PDF reopening confirms English notes and statuses. A local synthetic-data browser test verified Korean-note saving, unreviewed-share rejection in Korean, and explicit English review.

## NA values and sample quantities

User-directed sample quantity updates apply only to additional planned orders. Existing undelivered quantities remain unchanged. Missing raw database values stay NULL; the UI and English XLSX/PDF/email display NA (not available), never an inferred zero. Totals group only confirmed currencies and omit currency-NA amounts; absence of a known amount displays NA. Individual already-paid values remain intact. Regression tests cover missing values, genuine numeric zero, and exclusion of unassigned-currency amounts. PDF continuation rows now reserve enough space for repeated identifying fields.
