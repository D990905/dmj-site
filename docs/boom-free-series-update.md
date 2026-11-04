# BOOM Free Series SCC product update — 2026-11-03

Baseline: `0b174b0a4015af1930a4d3c172043d9ee87f0841`.

Update the existing FS 63/83/95 detail URLs and add their Hybrid variants to the live commerce catalog and brand/catalog discovery. Existing BOOM RS SCC turtle-mount race boards, prices, availability and all other products remain unchanged. FS Hybrid consumer prices were explicitly approved by the user on 2026-11-03: 63L KRW 3,190,000; 83L KRW 3,290,000; 95L KRW 3,390,000, VAT included. Stock and delivery still require consultation.

Primary source: manufacturer-provided **BOOM FREE SERIES Product Sheet_EN_V2_Optimized.pdf**, all seven pages reviewed. Rendered/extracted product images use the original PDF alpha masks. Private supplier correspondence and supplier prices are excluded from the public repository and product pages.

Verified dimensions (length × width × thickness, cm) and weights (Full Carbon / Hybrid):

- 63L: 150 × 45 × 13; 3.6 / 3.9 kg.
- 83L: 170 × 48.1 × 15.5; 4.1 / 4.6 kg.
- 95L: 194 × 48 × 16; 4.4 / 4.9 kg.

SCC = Shell Composite Construction, hollow shell, reinforced US mast track. Preserve differences between the FS US-track and RS turtle-mount product families. PDF performance statements are manufacturer design descriptions; no invented wind, rider-weight, speed or early-takeoff thresholds. Narrow-board standing balance tradeoff is retained. No generic all-foil compatibility promise. Included accessories and local availability must be confirmed before purchase; the PDF does not specify the delivery contents.

Public reference: https://levitaz.com/shop/product/boom-scc-boards/

Approved consumer prices are reflected in the product pages, brand/catalog cards and matching inquiry variants. No supplier costs are published. No order or supplier contact is performed by this update.

## Homepage launch popup

The user requested a public launch announcement after approving retail prices. The homepage dialog shows the three VAT-inclusive prices and links to the FS Hybrid product pages. Automatic display is once per tab session; an explicit seven-day hide option persists across tabs. A homepage button opens the announcement again on demand. Native dialog behavior provides keyboard focus containment and Escape dismissal; closing restores focus and scroll. The script does not open over another active dialog. Existing Supersonic, outlet and LISA campaign settings are preserved. No stock, immediate shipment or delivery date is promised.

## Model-specific official galleries and material comparison — 2026-11-04

After the popup edit was independently deployed as `e4d6e1e`, replace only the three FS detail galleries with the matching 63/83/95L official deck, rail and bottom views. The multi-size lineup is no longer in these detail galleries. Keep the popup and brand/catalog images, all prices, RS products and stock/delivery language unchanged. Public manufacturer URLs and photo-to-model mapping are recorded in `boom-free-official-gallery-sources.json`.

The current official web options do not identify Full Carbon vs Hybrid material. Captions therefore identify the exact volume and view without claiming the image proves Hybrid construction. PDF comparison remains 3.6/3.9, 4.1/4.6, 4.4/4.9kg (Full Carbon/Hybrid); web SCC option weights of 3.8, 4.1, 4.5kg are a separately dated source and are not reassigned to a material. Public comparison explains the discrepancy. Official EUR option prices cannot be attributed to Full Carbon and are not used as domestic Full Carbon prices. No domestic Full Carbon price is invented or calculated. Hybrid remains KRW3,190,000 / 3,290,000 / 3,390,000.

Validation: all nine images opened and checked against volume/view, gallery thumbnail selection, lightbox and wraparound navigation; mobile page width remains contained and comparison table scrolls horizontally with keyboard access. Required gallery manifest updated and deployment gallery check passes.
