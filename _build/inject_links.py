#!/usr/bin/env python3
"""
Phase 11 — Brand hub link rewiring.
For each brand hub (levitaz/ppc/takoon/wip):
  1. Map each `<article class="sku-card">` block to its detail page based on
     the model name in `<h3 class="sku-card__name">`.
  2. Convert `<span class="sku-card__more">상세 →</span>` into a stretched
     anchor that links to the detail page.
  3. Inject the brand comparison fragment after the main lineup section.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FRAG_DIR = ROOT / "products" / "_fragments"

# Model-substring → sku-id mapping.  Key = unique substring found in
# <h3 class="sku-card__name">…</h3> on the brand hub page.
# Order matters — first match wins. More specific patterns FIRST.
MAP = {
    "levitaz.html": [
        ("FW 540", "fw-540"),
        ("FW 680", "fw-680"),
        ("FW 790", "fw-790"),
        ("FW 900", "fw-900"),
        ("Boom FS 63", "boom-fs-63"),
        ("Boom FS 83", "boom-fs-83"),
        ("Boom FS 95", "boom-fs-95"),
        ("R6 Race", "r6-race"),
    ],
    "ppc.html": [
        ("Sonic FDS", "fds"),
        ("PPC M1-X", "m1-x"),
        ("PPC M1 Wing", "m1"),
        ("PPC M2", "m2"),
    ],
    "takoon.html": [
        # Skip wings (V4/V4 Pro/VX Pro/Double Skin) — no Phase 11 detail pages.
        ("Glide Midlength", "glide-midlength"),
        ("Ultra Glide", "ultra-glide"),
        ("Prosurf", "prosurf"),
        ("Slide</strong>", "slide"),
        ("Glide</strong>", "glide"),
    ],
    "wip.html": [
        ("Raley Impact Vest", "impact-vest"),
        ("Prowip 2.0", "helmet"),
        # §WB-OUT (2026-05-16): "Wing Belt" mapping 제거 — Wing Belt 카테고리 미수입. harness.html은 stub redirect. lock: reference_wip_wing_belt_not_imported.md
        # 'Hooded UV Quickdry' is a wetsuit — no Phase 11 detail page.
    ],
}

ARTICLE_RE = re.compile(
    r'(<article[^>]*class="[^"]*sku-card[^"]*"[^>]*>)(.*?)(</article>)',
    re.DOTALL
)
H3_RE = re.compile(r'<h3[^>]*class="[^"]*sku-card__name[^"]*"[^>]*>(.+?)</h3>', re.DOTALL)
MORE_RE = re.compile(r'<span class="sku-card__more"([^>]*)>([^<]+)</span>')


def find_sku_id(card_html, brand_file):
    h3 = H3_RE.search(card_html)
    if not h3:
        return None
    name_text = h3.group(1)
    # also try the article-block-level matches
    for substring, sku_id in MAP.get(brand_file, []):
        if substring in name_text or substring in card_html:
            return sku_id
    return None


def patch_brand_file(brand_file, brand_dir):
    path = ROOT / brand_file
    text = path.read_text(encoding="utf-8")
    original = text

    converted = 0
    skipped = 0

    def replace_article(match):
        nonlocal converted, skipped
        opening, body, closing = match.group(1), match.group(2), match.group(3)
        sku_id = find_sku_id(body, brand_file)
        if not sku_id:
            skipped += 1
            return match.group(0)
        href = f'products/{brand_dir}/{sku_id}.html'
        new_more = (
            f'<a class="sku-card__more sku-card__more--link" '
            f'href="{href}" aria-label="자세히 보기">상세 →</a>'
        )
        new_body = MORE_RE.sub(new_more, body, count=1)
        # Add data-href and 'sku-card--linkable' class on the article
        new_opening = opening
        if 'sku-card--linkable' not in new_opening:
            new_opening = new_opening.replace(
                'class="sku-card', 'class="sku-card sku-card--linkable', 1
            ) if 'sku-card--linkable' not in new_opening else new_opening
            # Avoid duplication
            new_opening = re.sub(
                r'class="sku-card sku-card--linkable\s+sku-card',
                'class="sku-card sku-card--linkable',
                new_opening,
            )
        if 'data-href=' not in new_opening:
            new_opening = new_opening.replace(
                '>', f' data-href="{href}">', 1
            )
        converted += 1
        return new_opening + new_body + closing

    text = ARTICLE_RE.sub(replace_article, text)

    # Inject comparison fragment before the existing footer/cross-sell area —
    # we anchor on the closing </main> tag and inject right before it (since
    # most existing brand hubs already include cross-sell sections etc).
    frag_path = FRAG_DIR / f"compare-{brand_dir}.html"
    if frag_path.exists():
        frag = frag_path.read_text(encoding="utf-8").strip()
        marker = "<!-- PHASE_11_COMPARE_INJECTED -->"
        if marker not in text:
            wrapped = f"{marker}\n{frag}\n"
            # Inject before </main> if present, else before </body>
            if "</main>" in text:
                text = text.replace("</main>", f"{wrapped}</main>", 1)
            elif "</body>" in text:
                text = text.replace("</body>", f"{wrapped}</body>", 1)

    if text != original:
        path.write_text(text, encoding="utf-8")

    return converted, skipped


def main():
    summary = []
    for brand_file in MAP.keys():
        brand_dir = brand_file.replace(".html", "")
        converted, skipped = patch_brand_file(brand_file, brand_dir)
        summary.append((brand_file, converted, skipped))

    print("─── Phase 11 — link rewiring summary ───")
    for f, c, s in summary:
        print(f"  {f}: {c} converted, {s} skipped")
    print()
    total_c = sum(s[1] for s in summary)
    total_s = sum(s[2] for s in summary)
    print(f"TOTAL: {total_c} converted · {total_s} skipped (no model match)")


if __name__ == "__main__":
    main()
