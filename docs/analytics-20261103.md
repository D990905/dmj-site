# Consent analytics update · 2026-11-03

Baseline: main 43f6c5a995547a85ab909a2ce86b08572069d7d0, isolated checkout.

## Measurement contract

- Page view = a document's first accepted view event after v2 consent. Duplicate script execution is ignored. Reload creates a new document/view; BFCache restoration does not create a new view.
- Tab session = existing sessionStorage UUID, cleared on withdrawal. It has no person-level meaning or cross-tab identity; no new visitor identifier is introduced.
- Engaged = document visible at the 30-second timer, not 30 seconds of active reading. Inquiry click = link activation, not submitted inquiry, sale, or purchase.
- UTC-day/IP HMAC visitor_bucket is retained only for existing ingestion rate limiting. Never label it unique visitors.
- Context is NULL on legacy records, not unknown collected data or zero visits. Outlet pages and missing product pages start measuring only after this frontend release and renewed consent. Do not backfill historical gaps.
- Source is a coarse referrer classification. Never store referrer URL/domain or raw user agent. Device type is coarse UA classification. No country/precise location or fingerprinting.
- Only enumerated UTM source/medium/campaign tags are stored. Unknown values become other. Never collect arbitrary URL queries or utm_term/content.
- Production hosts only in browser collector; local/test query and explicit automation excluded. Signed-in administrators are checked against existing is_ops_admin; errors fail closed. Server rejects obvious bot UAs. Undetectable bots/admin activity and old records remain limitations.
- Existing consent expires within 90 days. V1 consent requires renewal before v2 events. Withdrawal cancels timer, clears tab session, and gates all subsequent sends including cross-tab changes. Already transmitted records retain the existing 90-day retention.
- Test-origin server checks are retained with context.is_test=true and excluded by the report. Test origin permissions already existed; no new origin, credential, grant, or RLS relaxation.

## Deployment and validation

Add context column and service_role-only SECURITY INVOKER RPC with supabase/visit_context_v2.sql. It calls the existing rate-limited ingestion function. No new SECURITY DEFINER routine. Deploy supabase/edge/visit/index.ts to existing visit function, preserving verify_jwt=false and its custom publishable-key/origin validation. Deploy frontend last.

Admin dashboard report compares the latest 14 completed Korean-calendar dates against the preceding 14. It counts page views, tab sessions containing views, and inquiry link clicks, excludes marked tests, and separates missing context. No visitor count, inferred purchase conversion, or geographic statistics.

Run from repository root:

```
node tests/outlet-auth.cjs
node tests/visit-consent.cjs
node tests/visit-edge.cjs
python3 scripts/check-product-galleries.py
```

Backend v4 deployed. Live ingestion test ID ce9dc4b5-2942-4c9a-8bc9-9959080b2d2d: two HTTP 200 submissions, exactly one ops_visits row, v2 consent, is_test=true, arbitrary campaign reduced to other. Existing RLS retained. Security advisors unchanged (pre-existing private-table informational notices and leaked-password protection warning).

The outlet failure was a photo-signing/auth event race: INITIAL_SESSION/PROFILE_SYNCED invalidated the generation during signing, and the page stopped on an error. Same-account synchronization now preserves the cache; actual account changes discard stale responses and retry up to three times. No product, price, availability, or storage policy changes.
