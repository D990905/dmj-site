# Drift retail pricing — 2026-11-11

User requested pricing by the same method as other PPC products, then deployment. This supersedes the initial inquiry-only pricing in official-source.md.

Official Drift source: https://ppcfoiling.com/products/drift-wing
Verified displayed USD amounts and variants are recorded in official-source.md: 2.7m 2210 / 68210681446585; 3.5m 2340 / 68143227338937; 4.3m 2520 / 68210682003641. No SKU is invented. Boom inclusion remains unconfirmed.

Established basis: data/commerce.json PPC Sonic FDS, commit e12c7b6 (2026-09-29), USD 1390 KRW, freight allowance KRW 200000, duty assumption 8%, VAT 10%, discount 10%. This is the existing pricing-policy FX, not today's exchange rate or a verified shipping/customs quote.
Formula: ((USD × 1390 + 200000) × 1.08 × 1.10) × 0.90, floor to KRW 1000, then half-up round to KRW 10000.
The floor step is documented by /Users/dannyok/Documents/Codex/2026-09-24/new-chat-2/outputs/운영시스템/pricing-core.cjs; final KRW 10000 rounding is storefront commit e7e5691 (2026-09-30).
Original Sonic source snapshot: /Users/dannyok/Documents/Codex/2026-09-24/new-chat-2/work/sonic-official-current.json. Its nine regular prices USD 2420, 2480, 2530, 2620, 2680, 2790, 2900, 3010, 3105 reproduce all nine e12c7b6 thousand-KRW prices and current rounded prices exactly.

2.7m: raw KRW 3498315.48 → 3498000 → retail KRW 3500000.
3.5m: raw KRW 3691519.92 → 3691000 → retail KRW 3690000.
4.3m: raw KRW 3959033.76 → 3959000 → retail KRW 3960000.

VAT-inclusive fixed retail prices. Availability remains inquiry; domestic configuration and arrival date require consultation. All original 107 non-Drift product records remain unchanged. Video and specifications changes are outside this pricing patch.
