// AUTO-GENERATED from products.json. Do not edit manually.
// DO_NOT_REVERT §171-B v3 (Danny 2026-05-13) — inline products data for file:// + fetch resilience.
// cart.html / quote.html load this BEFORE cart.js so PRODUCTS lookups work offline / on file:// origin.
// Regenerate: see outputs/build_products_js.py OR run inline Python: json.dumps(load(products.json))
window.DMJ_PRODUCTS_INLINE = {
  "_meta": {
    "version": "1.6",
    "updated": "2026-05-13",
    "note": "v1.6 (2026-05-13) — §171 v6 canonical 산식 적용 (운송 baked, cart=0). v1.5.3 (2026-05-12) — PPC 라인업 5종 lock (M1/M1-X/M2/Sonic FDS/M1-R SDS, 33 SKU). 신규 5 SKU: M140M/M150M/M170M/SNC74M. 표기 4건 정정 + 양력 정의 확장 + Boom 용어 정리.",
    "currency": "KRW",
    "status_legend": {
      "verified": "본사 자료 또는 Danny 보유 자료에서 확인됨",
      "danny-review": "추정·미확인 — Danny가 본사 자료로 검증 필요",
      "estimate": "한국 시장 통상 가격 기준 추정"
    },
    "ppc_lineup_order": [
      "ppc-m2",
      "ppc-m1x",
      "ppc-m1",
      "ppc-m1r-sds",
      "ppc-fds"
    ],
    "ppc_tier_labels": {
      "ppc-m2": "입문 (Entry)",
      "ppc-m1x": "중급 (Mid)",
      "ppc-m1": "상급 (Advanced)",
      "ppc-m1r-sds": "세미 듀얼스킨 (SDS · 세미프로)",
      "ppc-fds": "풀 듀얼스킨 (FDS · 선수/Race)"
    },
    "pricing_methodology": {
      "version": "v6",
      "_redacted": "내부 가격 메타데이터 사이트 노출 금지 (§128-K). SoT 파일은 outputs/ 디렉토리에 별도 보관.",
      "warning": "본 파일은 KRW 가격을 박지 않습니다 (Cruise·Wing 일부 size_pricing_KRW 예외).",
      "takoon_wing_size_guide_SoT": "reference_takoon_wing_size_guide.md (Danny 2026-05-07 forward — 체중별 quiver + Boom V2 매핑)",
      "takoon_inflatable_boards_unmapped": {
        "note": "v1.4 발견 → 5종 (Phase 1 Chrome MCP fetch). Inflatable category 전체. Danny 검수 후 사이트 노출 결정.",
        "unmapped_skus": [
          {
            "handle": "glide-air",
            "title": "Glide Air",
            "sizes": [
              "4'10",
              "5'3",
              "5'6"
            ],
            "colors": [
              "Dark Blue",
              "Light Blue"
            ],
            "price_eur_range": [
              399.2,
              432.0
            ],
            "weight_g": 11000,
            "status": "danny-review"
          },
          {
            "handle": "glide-air-midlength",
            "title": "Glide Air Midlength",
            "sizes": [
              "5'6",
              "5'9",
              "6'3"
            ],
            "colors": [
              "Light Blue",
              "Dark Blue"
            ],
            "price_eur_range": [
              448.0,
              480.0
            ],
            "weight_g": 15000,
            "status": "danny-review"
          },
          {
            "handle": "escape-air",
            "title": "Escape Air",
            "sizes": [
              "6'0",
              "6'6",
              "7'2",
              "7'10",
              "8'0"
            ],
            "price_eur_range": [
              412.5,
              461.25
            ],
            "weight_g": 11000,
            "status": "danny-review"
          },
          {
            "handle": "escape-cst",
            "title": "Escape (CST hardboard)",
            "sizes": [
              "7.8",
              "8'0",
              "8'4"
            ],
            "price_eur_range": [
              786.75,
              824.25
            ],
            "weight_g": 11000,
            "status": "danny-review"
          },
          {
            "handle": "escape-pro-cst",
            "title": "Escape Pro (CST hardboard)",
            "sizes": [
              "7'8",
              "8'0",
              "8'4"
            ],
            "price_eur_range": [
              786.75,
              824.25
            ],
            "weight_g": 15000,
            "status": "danny-review"
          }
        ],
        "discovered": "2026-05-07 (스크린샷 catalog) + 2026-05-07 (Chrome MCP /products.json fetch)",
        "decision_pending": "단무지 라인업 포함 여부 — Danny 결정 대기 (라이트윈드 입문·초급 시장 확장 가능성)"
      },
      "takoon_full_spec_db": {
        "file": "site/data/takoon-full-spec.json",
        "source": "takoon.com Shopify /products.json en-int locale (EUR)",
        "fetched": "2026-05-07",
        "method": "Chrome MCP /products.json + DOM render <pre> + get_page_text 우회",
        "sku_count": 87,
        "categories_covered": [
          "boards (cruise, slide, glide, glide-midlength, ultra-glide, prosurf)",
          "inflatable boards (glide-air, glide-air-midlength, escape-air, escape-cst, escape-pro-cst)",
          "wings (V4, V4 Pro, VX Pro V2, Cloud One, Parawing Cloud)",
          "foil sets (Flow Al/Carbon, Flare Al/Carbon, X-Glide V2, Pump One, Pump Aluminium, Starter)",
          "front wings (Flow, Flare, Flash, Swell, Pace, X-Glide V2, XS-Glide, Pump One/Pro, Starter)",
          "stabs (Glide HA 5, Flash, Pump HA 4, Carve 190, Glide 220)",
          "masts (Aluminium 17.5/19 각 6사이즈, Carbon HR 18/16, Carbon HM 13/16/18, UHM 13)",
          "boom (Carbon V2 950/1010), 액세서리 (가방/리쉬/footstrap)"
        ],
        "eur_to_krw_observation": {
          "vx_pro_v2_avg_ratio": 1289,
          "cruise_ratios": {
            "5'6": 1454,
            "5'10": 1332,
            "6'0": 1455
          },
          "conclusion": "한국 store 가격은 EUR × 고정 환율이 아닌 SKU별 개별 책정. EU 산식(× 1450 + 운송 + 관세)은 적용 안 됨. 신규 SKU(Glide Air 등) 한국 가격은 Danny 직접 결정 필요 — Takoon SARL과 협의 가격."
        }
      }
    },
    "last_change": "§170 v7 (2026-05-13) — Levitaz R6 FW V1/V2/V3 본사 공식 spec lock: AR 9.5 (잘못된 값) → V1 AR 13.7 / V2 AR 12.9 / V3 AR 14.3. Area V1 478→479cm² (UI 480 round) · V2 430cm² · V3 530cm². Span+Weight+Item number 추가. R6 RW V2 spec 추가 (172cm² · AR 11.3 · 227g · G462363). DO_NOT_REVERT §170 v7.",
    "wip_ordered_manifest": "data/wip-ordered-sku.json"
  },
  "wings": {
    "ppc-m2": {
      "brand": "PPC",
      "model": "M2",
      "tier": "M2",
      "level_target": [
        "beginner",
        "intermediate"
      ],
      "tagline": "입문·초급도 컨트롤이 쉬운 versatile all-rounder",
      "sizes_m2": [
        3.5,
        4.0,
        4.5,
        5.0,
        5.5,
        6.0,
        7.0
      ],
      "construction": "Standard PE + Dyneema reinforce",
      "warranty_years": 5,
      "image": "https://cdn.shopify.com/s/files/1/0639/7814/3929/files/f1b1ef9c627f14c84b46165096846486.jpg?v=1774912416",
      "page_url": "ppc.html#m2",
      "status": "verified",
      "why": "PPC 입문 라이더의 첫 wing. 첫 시즌 학습이 부드러워서 후회 없어요.",
      "size_pricing_KRW": {
        "3.0m": 2250000,
        "4.0m": 2270000,
        "5.0m": 2300000,
        "6.0m": 2410000
      },
      "_v53_updated": true,
      "_v6_updated": "§171 v6 canonical (Danny 2026-05-13): (KRW + ship) × 1.188, ship baked, cart=0",
      "sizes": [
        "3.0m",
        "4.0m",
        "5.0m",
        "6.0m"
      ]
    },
    "ppc-m1x": {
      "brand": "PPC",
      "model": "M1-X",
      "tier": "M1-X",
      "level_target": [
        "intermediate",
        "advanced"
      ],
      "tagline": "ExoPE-85 경량 — 중급 라이더의 다음 단계",
      "sizes_m2": [
        3.5,
        4.0,
        4.5,
        5.0,
        5.5,
        6.0,
        7.0
      ],
      "construction": "ExoPE-85 lightweight fabric + Dyneema",
      "warranty_years": 5,
      "image": "https://cdn.shopify.com/s/files/1/0639/7814/3929/files/0a1658397c6edc7f1c4d4868accda992.jpg?v=1776403592",
      "page_url": "ppc.html#m1x",
      "status": "verified",
      "why": "M1 좋은데 무게 부담됐던 분들의 답안. ExoPE-85 원단으로 손목 안 아픈 wing.",
      "size_pricing_KRW": {
        "3.0m": 3130000,
        "3.5m": 3150000,
        "4.0m": 3160000,
        "4.5m": 3170000,
        "5.0m": 3200000,
        "5.5m": 3350000,
        "6.0m": 3440000,
        "7.0m": 3640000
      },
      "_v53_updated": true,
      "_v6_updated": "§171 v6 canonical (Danny 2026-05-13): (KRW + ship) × 1.188, ship baked, cart=0",
      "sizes": [
        "3.0m",
        "3.5m",
        "4.0m",
        "4.5m",
        "5.0m",
        "5.5m",
        "6.0m",
        "7.0m"
      ]
    },
    "ppc-m1": {
      "brand": "PPC",
      "model": "M1",
      "tier": "M1",
      "level_target": [
        "advanced",
        "pro"
      ],
      "tagline": "정밀 컨트롤·고출력 — 상급 라이더의 reference wing",
      "sizes_m2": [
        3.5,
        4.0,
        4.5,
        5.0,
        5.5,
        6.0,
        7.0
      ],
      "construction": "Premium PE + Dyneema double-skin reinforce",
      "warranty_years": 5,
      "image": "https://cdn.shopify.com/s/files/1/0639/7814/3929/files/a72f6737697cd9be2999d13c37ed1b21.png?v=1773888787",
      "page_url": "ppc.html#m1",
      "status": "verified",
      "why": "야생마처럼 달리는 정밀 control wing. 상급 라이더의 reference 1순위.",
      "size_pricing_KRW": {
        "3.0m": 3150000,
        "3.5m": 3160000,
        "4.0m": 3170000,
        "4.5m": 3200000,
        "5.0m": 3220000,
        "5.5m": 3380000,
        "6.0m": 3520000,
        "7.0m": 3960000
      },
      "_v53_updated": true,
      "_v6_updated": "§171 v6 canonical (Danny 2026-05-13): (KRW + ship) × 1.188, ship baked, cart=0",
      "sizes": [
        "3.0m",
        "3.5m",
        "4.0m",
        "4.5m",
        "5.0m",
        "5.5m",
        "6.0m",
        "7.0m"
      ]
    },
    "ppc-fds": {
      "brand": "PPC",
      "model": "Sonic FDS",
      "tier": "FDS",
      "level_target": [
        "pro"
      ],
      "tagline": "Full Dual Skin race — 선수 레벨",
      "sizes_m2": [
        3.5,
        4.0,
        4.5,
        5.0,
        5.5,
        6.0
      ],
      "construction": "Full Dual Skin (FDS) — race-spec",
      "warranty_years": 5,
      "image": "https://cdn.shopify.com/s/files/1/0639/7814/3929/files/3cd5afb5c68228bf40b4b670e7eebdc0.png?v=1773894554",
      "page_url": "ppc.html#fds",
      "status": "verified",
      "why": "선수 dual-skin race wing. 업윈드와 최고 속도에서 압도적이에요",
      "size_pricing_KRW": {
        "4.0m": 3920000,
        "4.5m": 4000000,
        "5.0m": 4070000,
        "5.5m": 4210000,
        "6.0m": 4290000,
        "6.5m": 4450000,
        "7.0m": 4610000,
        "7.4m": 4770000
      },
      "_v53_updated": true,
      "_v6_updated": "§171 v6 canonical (Danny 2026-05-13): (KRW + ship) × 1.188, ship baked, cart=0",
      "sizes": [
        "4.0m",
        "4.5m",
        "5.0m",
        "5.5m",
        "6.0m",
        "6.5m",
        "7.0m",
        "7.4m"
      ]
    },
    "takoon-v4": {
      "brand": "Takoon",
      "model": "Wing V4",
      "level_target": [
        "beginner",
        "intermediate"
      ],
      "tagline": "가성비 입문 wing — 첫 입문 세트로 부담 없이",
      "sizes_m2": [
        2.5,
        3.0,
        3.5,
        4.0,
        4.5,
        5.0,
        5.5,
        6.0
      ],
      "construction": "Standard polyester + Dacron leading edge",
      "warranty_years": 2,
      "image": "https://cdn.shopify.com/s/files/1/2503/9576/files/Wings-V4-Green---Image-07_updated.png",
      "page_url": "takoon.html#v4",
      "status": "verified",
      "why": "freeride·wave 양쪽 즐기고 싶은 라이더에게 딱. 입문 라이더에게 인기.",
      "note": "[Danny review] 가격 vs Takoon V4 Pro 차이 본사 자료 cross-check",
      "size_pricing_KRW": {
        "2.5":1460000,
        "3.0":1510000,
        "3.5":1570000,
        "4.0":1620000,
        "4.5":1680000,
        "5.0":1750000,
        "5.5":1780000,
        "6.0":1840000
      },
      "size_pricing_EUR": {
        "2.5": 545,
        "3.0": 569,
        "3.5": 595,
        "4.0": 619,
        "4.5": 645,
        "5.0": 679,
        "5.5": 695,
        "6.0": 721
      },
      "_v54_updated": "§171 v6 canonical (Danny 2026-05-13): (KRW + ship) × 1.188, ship baked, cart=0",
      "_v54_corrected": "옛 값 1,249K~1,556K (shipping 더블링) → RETAIL_EUR × 1800 × 1.188 only · 운송 cart.js 별도",
      "site_url": "https://takoon.com (Wing V4 product page)",
      "verified_invoice": {
        "size": "5.5m"
      },
      "color": "green",
      "positioning": "versatile / standard",
      "sizes_count": 8
    },
    "takoon-v4-pro": {
      "brand": "Takoon",
      "model": "Wing V4 Pro",
      "level_target": [
        "intermediate",
        "advanced"
      ],
      "tagline": "Pro-level construction을 합리적 가격에",
      "sizes_m2": [
        2.5,
        3.0,
        3.5,
        4.0,
        4.5,
        5.0,
        5.5,
        6.0,
        6.5
      ],
      "construction": "Pro fabric + reinforced leading edge",
      "warranty_years": 2,
      "image": "https://cdn.shopify.com/s/files/1/2503/9576/files/Wings-V4-Pro---Image-06_updated.png",
      "page_url": "takoon.html#v4-pro",
      "status": "verified",
      "why": "V4의 2026 Pro 진화형. stiffness 한 단계 강화돼서 응답이 즉각적.",
      "size_pricing_KRW": {
        "2.5": 1770000,
        "3.0":1840000,
        "3.5":1900000,
        "4.0":1960000,
        "4.5":2030000,
        "5.0":2110000,
        "5.5":2200000,
        "6.0":2280000,
        "6.5":2370000
      },
      "size_pricing_EUR": {
        "2.5": 689,
        "3.0": 719,
        "3.5": 749,
        "4.0": 779,
        "4.5": 809,
        "5.0": 849,
        "5.5": 889,
        "6.0": 929,
        "6.5": 969
      },
      "_v54_updated": "§171 v6 canonical (Danny 2026-05-13): (KRW + ship) × 1.188, ship baked, cart=0",
      "_v54_corrected": "옛 값 1,499K~1,988K (shipping 더블링) → RETAIL_EUR × 1800 × 1.188 only",
      "site_url": "https://takoon.com (Wing V4 Pro product page)",
      "verified_invoice": {
        "size": "6.5m"
      },
      "color": "orange/베이지",
      "fabric": "UPE Project 85",
      "positioning": "premium / lighter",
      "sizes_count": 9,
      "unique_size": "6.5m (V4에 없음, 90+kg light wind 전용)"
    },
    "takoon-vx-pro-2": {
      "brand": "Takoon",
      "model": "Wing VX Pro 2",
      "level_target": [
        "advanced",
        "pro"
      ],
      "tagline": "Performance wing — race·freerace 지향",
      "sizes_m2": [
        3.0,
        3.5,
        4.0,
        4.5,
        5.0,
        5.5,
        6.0
      ],
      "construction": "Race-spec fabric + boom + cambered profile",
      "warranty_years": 2,
      "image": "https://cdn.shopify.com/s/files/1/2503/9576/files/Wings-VX-pro2-5.0---Image-03_updated.png",
      "page_url": "takoon.html#vx-pro-2",
      "status": "verified",
      "why": "race-leaning wing. 업윈드와 long distance에 강해요.",
      "note": "[Danny review] PPC FDS vs Takoon VX Pro 2 — 선수급에서 어느 쪽 추천?",
      "size_pricing_KRW": {
        "3.0":2030000,
        "3.5":2090000,
        "4.0":2160000,
        "4.5":2220000,
        "5.0":2310000,
        "5.5": 2390000,
        "6.0":2480000
      },
      "size_pricing_EUR": {
        "3.0": 809,
        "3.5": 839,
        "4.0": 869,
        "4.5": 899,
        "5.0": 939,
        "5.5": 979,
        "6.0": 1019
      },
      "_v54_updated": "§171 v6 canonical (Danny 2026-05-13): (KRW + ship) × 1.188, ship baked, cart=0",
      "_v54_corrected": "옛 값 1,517K~1,901K (shipping 더블링·EUR base error) → RETAIL_EUR × 1800 × 1.188 only",
      "site_url": "https://takoon.com (Wing VX Pro V2 product page)",
      "verified_invoice": {
        "size": "5.0m"
      },
      "color": "white",
      "positioning": "race-leaning / freerace",
      "sizes_count": 7
    },
    "ppc-m1r-sds": {
      "brand": "PPC",
      "model": "M1",
      "tier": "M1",
      "level_target": [
        "advanced",
        "pro"
      ],
      "tagline": "정밀 컨트롤·고출력 — 상급 라이더의 reference wing",
      "sizes_m2": [
        3.5,
        4.0,
        4.5,
        5.0,
        5.5,
        6.0,
        7.0
      ],
      "construction": "Premium PE + Dyneema double-skin reinforce",
      "warranty_years": 5,
      "image": "https://cdn.shopify.com/s/files/1/0639/7814/3929/files/a72f6737697cd9be2999d13c37ed1b21.png?v=1773888787",
      "page_url": "ppc.html#m1",
      "status": "verified",
      "why": "야생마처럼 달리는 정밀 control wing. 상급 라이더의 reference 1순위.",
      "size_pricing_KRW": {
        "4.5m": 3360000,
        "5.0m": 3390000,
        "5.5m": 3480000,
        "6.0m": 3640000,
        "6.5m": 3860000
      },
      "_v53_updated": true,
      "_v6_updated": "§171 v6 canonical (Danny 2026-05-13): (KRW + ship) × 1.188, ship baked, cart=0",
      "sizes": [
        "4.5m",
        "5.0m",
        "5.5m",
        "6.0m",
        "6.5m"
      ],
      "handle": "ppc-m1r-sds",
      "title": "M1-R SDS",
      "title_long": "M1-R SDS — Semi Dual Skin Race Wing",
      "family": "wing",
      "_v53_new": true,
      "_note": "v5.3 신규 — Sonic FDS와 동일 SDS 기술 적용된 세미프로 윙. 5 사이즈 (4.5/5.0/5.5/6.0/6.5m)."
    }
  },
  "foils": {
    "lvz-fs540": {
      "brand": "Levitaz",
      "model": "Free Series FW 540",
      "wing_area_cm2": 540,
      "span_cm": 67,
      "aspect_ratio": 8.4,
      "level_target": [
        "advanced",
        "pro"
      ],
      "use_case": [
        "wing-strong",
        "kite-strong",
        "big-wave"
      ],
      "tagline": "탑엔드 스피드 — 강풍·고속 전용",
      "image": "https://levitaz.com/uploads/shop/levitaz-shaka-ha-1100-75-hydrofoil-side-front.jpg",
      "page_url": "levitaz.html#fw540",
      "status": "verified",
      "why": "강풍 22~35노트에서 가장 정확하게 달리는 윙. 탑엔드 스피드 우선."
    },
    "lvz-fs680": {
      "brand": "Levitaz",
      "model": "Free Series FW 680",
      "wing_area_cm2": 680,
      "span_cm": 77,
      "aspect_ratio": 8.7,
      "level_target": [
        "advanced"
      ],
      "use_case": [
        "wing-allround",
        "kite-allround",
        "wave"
      ],
      "tagline": "상급 표준 — 작은 사이즈로 컨트롤·반응 우선",
      "image": "https://levitaz.com/uploads/shop/levitaz-shaka-ha-1300-75-hydrofoil-side-front_2022-05-12-073947_xgmk.jpg",
      "page_url": "levitaz.html#fw680",
      "status": "verified",
      "why": "한국 표준 — 한 사이즈만 고르라면 무조건 이거. 16~30노트 만능."
    },
    "lvz-fs790": {
      "brand": "Levitaz",
      "model": "Free Series FW 790",
      "wing_area_cm2": 790,
      "span_cm": 90,
      "aspect_ratio": 10.3,
      "level_target": [
        "intermediate"
      ],
      "use_case": [
        "wing-mid",
        "kite-mid",
        "downwind",
        "soft-wave"
      ],
      "tagline": "중급 한국 표준 — 핸들링이 쉽습니다",
      "image": "https://levitaz.com/uploads/shop/levitaz-shaka-ha-1600-pro-90-hydrofoil-side-front.jpg",
      "page_url": "levitaz.html#fw790",
      "status": "verified",
      "why": "글라이드가 끝없이 이어지는 여유로운 윙. downwind 라이더 인기 만점."
    },
    "lvz-fs900": {
      "brand": "Levitaz",
      "model": "Free Series FW 900",
      "wing_area_cm2": 900,
      "span_cm": 110,
      "aspect_ratio": 13.3,
      "level_target": [
        "intermediate"
      ],
      "use_case": [
        "light-wind",
        "downwind",
        "heavy-rider"
      ],
      "tagline": "중급 입문 wing — 약풍·8 kn에서도 떠오름",
      "image": "https://levitaz.com/uploads/shop/levitaz-shaka-l-2000-75-hydrofoil-side-front.jpg",
      "page_url": "levitaz.html#fw900",
      "status": "verified",
      "why": "약풍 12노트에서 마법 부리는 윙. 다운윈드·SUP foil 필수."
    },
    "lvz-mast76": {
      "brand": "Levitaz",
      "model": "Free Series Mast 76",
      "length_cm": 76,
      "level_target": [],
      "tagline": "특수 케이스 — pump foil·shorter mast 시",
      "image": "https://levitaz.com/uploads/shop/levitaz-mast-90-full-carbon-foil-1000x1000px.jpg",
      "page_url": "levitaz.html#mast76",
      "status": "verified",
      "why": "입문·초급용 짧은 mast. 떨어져도 회복 쉽고 무서움 줄어듭니다."
    },
    "lvz-mast84": {
      "brand": "Levitaz",
      "model": "Free Series Mast 84",
      "length_cm": 84,
      "level_target": [
        "intermediate"
      ],
      "tagline": "중급 표준 (~83cm 매핑) — 가장 일반적인 길이",
      "image": "https://levitaz.com/uploads/shop/levitaz-mast-90-full-carbon-foil-1000x1000px.jpg",
      "page_url": "levitaz.html#mast84",
      "status": "verified",
      "why": "중급용 표준 mast. 76→96 사이의 자연스러운 진보."
    },
    "lvz-mast96": {
      "brand": "Levitaz",
      "model": "Free Series Mast 96",
      "length_cm": 96,
      "level_target": [
        "advanced"
      ],
      "tagline": "상급 (~93cm 매핑) — 다운윈드·ocean swell",
      "image": "https://levitaz.com/uploads/shop/levitaz-mast-90-full-carbon-foil-1000x1000px.jpg",
      "page_url": "levitaz.html#mast96",
      "status": "verified",
      "why": "상급~선수용 긴 mast. lift 더 높고 글라이드 더 길어요."
    },
    "tkn-starter": {
      "brand": "Takoon",
      "model": "Starter",
      "type": "foil-set",
      "_category_lock": "[§171 v7 Danny 2026-05-14] Takoon Starter = 입문 포일 SET (front wing + stab + mast + fuselage 묶음). type='front_wing' 영구 X. DO_NOT_REVERT §171 v7.",
      "level_target": [
        "beginner"
      ],
      "tagline": "입문 전용 — paddle-up 쉬운 큰 면적",
      "page_url": "takoon.html#foil-starter",
      "status": "danny-review",
      "why": "입문·초급 라이더가 가장 빠르게 lift 경험하는 큰 면적 + 여유로운 stall."
    },
    "tkn-xglide-v2": {
      "brand": "Takoon",
      "model": "X-Glide V2",
      "type": "foil-set",
      "_category_lock": "[§171 v7 Danny 2026-05-14] Takoon X-Glide V2 = 포일 SET (front wing 1250 + stab + mast + fuselage). type='front_wing' 영구 X. DO_NOT_REVERT §171 v7.",
      "level_target": [
        "beginner"
      ],
      "tagline": "입문~중급 cross — light-wind 강점",
      "page_url": "takoon.html#foil-xglide-v2",
      "status": "danny-review",
      "why": "약풍 day에서 paddle-up이 일찍 살아남. 입문 후 1년차까지 OK."
    },
    "tkn-flow": {
      "brand": "Takoon",
      "model": "Flow",
      "type": "front_wing",
      "level_target": [
        "intermediate",
        "advanced"
      ],
      "tagline": "한국 freeride 표준 — jibe·tack 자연",
      "page_url": "takoon.html#foil-flow",
      "status": "danny-review",
      "why": "중급 freeride 컨디션에서 가장 많이 선택되는 wing. 학습 곡선 완화."
    },
    "tkn-flare": {
      "brand": "Takoon",
      "model": "Flare",
      "type": "front_wing",
      "level_target": [
        "intermediate",
        "advanced"
      ],
      "tagline": "정밀 컨트롤 — 상급 진입 wing",
      "page_url": "takoon.html#foil-flare",
      "status": "danny-review",
      "why": "Flow 다음 단계 — sharp upwind, jibe 정밀도 향상. M1·FW 680과 매칭."
    },
    "tkn-flow-carbon": {
      "brand": "Takoon",
      "model": "Flow Carbon",
      "type": "foil-set",
      "_category_lock": "[§171 v7 Danny 2026-05-14] Takoon Flow Carbon = 풀카본 포일 assembly (front wing + mast + stab 묶음). type='front_wing' 영구 X. DO_NOT_REVERT §171 v7.",
      "level_target": [
        "pro"
      ],
      "tagline": "선수급 carbon — race·high-speed",
      "page_url": "takoon.html#foil-flow-carbon",
      "status": "danny-review",
      "why": "풀카본 경량화 + 강성. wing race·downwind 전문 분야."
    },
    "tkn-flare-carbon": {
      "brand": "Takoon",
      "model": "Flare Carbon",
      "type": "foil-set",
      "_category_lock": "[§171 v7 Danny 2026-05-14] Takoon Flare Carbon = 풀카본 포일 assembly (front wing + mast + stab 묶음). type='front_wing' 영구 X. DO_NOT_REVERT §171 v7.",
      "level_target": [
        "pro"
      ],
      "tagline": "Flare 카본 — race precision",
      "page_url": "takoon.html#foil-flare-carbon",
      "status": "danny-review",
      "why": "선수급 freeride·race wing. 96cm mast + thin stab과 조합."
    },
    "tkn-swell": {
      "brand": "Takoon",
      "model": "Swell",
      "type": "front_wing",
      "level_target": [
        "pro"
      ],
      "tagline": "Wave·downwind 전용",
      "page_url": "takoon.html#foil-swell",
      "status": "danny-review",
      "why": "Wave riding·downwind run에 특화된 mid-AR wing. Surf·prosurf 보드와 매칭."
    },
    "tkn-flash": {
      "brand": "Takoon",
      "model": "Flash",
      "type": "front_wing",
      "level_target": [
        "pro"
      ],
      "tagline": "Race·top-speed 전용",
      "page_url": "takoon.html#foil-flash",
      "status": "danny-review",
      "why": "최고 속도 race wing. Formula·long-distance 라이딩."
    },
    "tkn-mast-aluminium-175": {
      "brand": "Takoon",
      "model": "Aluminium Mast 17.5mm",
      "type": "mast",
      "length_cm": 75,
      "level_target": [
        "beginner"
      ],
      "tagline": "입문 알루 mast — 짧고 단단",
      "page_url": "takoon.html#mast-alu-175",
      "status": "danny-review",
      "why": "입문 alu mast — 가볍게 떨어져도 회복 쉽고 가성비 좋음."
    },
    "tkn-mast-aluminium-19": {
      "brand": "Takoon",
      "model": "Aluminium Mast 19mm",
      "type": "mast",
      "length_cm": 80,
      "level_target": [
        "beginner"
      ],
      "tagline": "입문 알루 mast — 표준 길이",
      "page_url": "takoon.html#mast-alu-19",
      "status": "danny-review",
      "why": "입문~중급 표준 알루 mast. 80cm freeride 학습."
    },
    "tkn-mast-carbon-hr-16": {
      "brand": "Takoon",
      "model": "Carbon HR 16mm",
      "type": "mast",
      "length_cm": 84,
      "level_target": [
        "intermediate",
        "advanced"
      ],
      "tagline": "중급 카본 mast — 강성·반응",
      "page_url": "takoon.html#mast-carbon-hr-16",
      "status": "danny-review",
      "why": "한국 freeride 표준 mast. carbon HR — 강성 충분하면서 학습 부담 적음."
    },
    "tkn-mast-carbon-hm-16": {
      "brand": "Takoon",
      "model": "Carbon HM 16mm",
      "type": "mast",
      "length_cm": 84,
      "level_target": [
        "intermediate",
        "advanced"
      ],
      "tagline": "상급 카본 mast — High Modulus",
      "page_url": "takoon.html#mast-carbon-hm-16",
      "status": "danny-review",
      "why": "고강성 HM 카본. precision jibe·sharp turn. M1·FW 680과 매칭."
    },
    "tkn-mast-carbon-hm-13": {
      "brand": "Takoon",
      "model": "Carbon HM 13mm",
      "type": "mast",
      "length_cm": 96,
      "level_target": [
        "pro"
      ],
      "tagline": "선수 race mast — 96cm thin",
      "page_url": "takoon.html#mast-carbon-hm-13",
      "status": "danny-review",
      "why": "Race용 96cm thin mast. 최소 drag·최고 속도 전용"
    },
    "tkn-stab-evo": {
      "brand": "Takoon",
      "model": "Evo Stab",
      "type": "stab",
      "level_target": [
        "beginner"
      ],
      "tagline": "입문 stab — 안정 우선",
      "page_url": "takoon.html#stab-evo",
      "status": "danny-review",
      "why": "입문·초급 stable pitch. 흔들림 적고 회복 쉬움."
    },
    "tkn-stab-glide": {
      "brand": "Takoon",
      "model": "Glide Stab",
      "type": "stab",
      "level_target": [
        "beginner",
        "intermediate"
      ],
      "tagline": "Glide 효율 stab",
      "page_url": "takoon.html#stab-glide",
      "status": "danny-review",
      "why": "Lift 유지력 — paddle-up 후 안정적인 cruising."
    },
    "tkn-stab-carve": {
      "brand": "Takoon",
      "model": "Carve Stab",
      "type": "stab",
      "level_target": [
        "intermediate",
        "advanced"
      ],
      "tagline": "Jibe·tack precision stab",
      "page_url": "takoon.html#stab-carve",
      "status": "danny-review",
      "why": "회전 응답 빠른 stab. jibe 라인 정밀화."
    },
    "tkn-stab-glide-ha": {
      "brand": "Takoon",
      "model": "Glide HA Stab",
      "type": "stab",
      "level_target": [
        "intermediate",
        "advanced",
        "pro"
      ],
      "tagline": "High Aspect glide stab",
      "page_url": "takoon.html#stab-glide-ha",
      "status": "danny-review",
      "why": "고AR stab — 최고 속도·downwind 글라이딩 우선. 선수급 매칭"
    },
    "lvz-stab180": {
      "brand": "Levitaz",
      "model": "Free Series Stab 180",
      "type": "stab",
      "level_target": [
        "intermediate",
        "advanced"
      ],
      "tagline": "Free Series 표준 stab",
      "page_url": "levitaz.html#stab180",
      "status": "danny-review",
      "why": "Levitaz Free Series 표준 stab — FW 680/790과 매칭."
    },
    "lvz-r6-fw-v1": {
      "brand": "Levitaz",
      "model": "R6 FW V1",
      "wing_area_cm2": 479,
      "wing_area_display_cm2": 480,
      "span_cm": 80,
      "aspect_ratio": 13.7,
      "weight_g": 1248,
      "item_number": "G461562",
      "level_target": [
        "pro"
      ],
      "use_case": [
        "wing-race",
        "kite-race",
        "race-grade"
      ],
      "tagline": "선수 race-grade V1 — Olympic 검증 카본 hydrofoil (primary 사이즈)",
      "image": "https://levitaz.com/uploads/shop/levitaz_race_series_R6V1_vl1000x1000px_2024.jpg",
      "page_url": "products/levitaz/r6-race.html",
      "status": "verified",
      "why": "Wingfoil race + Kite race cross-platform 호환 — 0.1초가 의미를 갖는 환경. Olympic 검증 race grade. V1(479cm² · AR 13.7)은 primary 사이즈 — 일반 race 컨디션 cover.",
      "note": "[§170 v7 Danny 2026-05-13] Levitaz 본사 공식 spec — Area 479cm² (UI 480 round) · Span 80cm · AR 13.7 · 1248g · Item G461562. EUR €1,299 Excl VAT."
    },
    "lvz-r6-fw-v2": {
      "brand": "Levitaz",
      "model": "R6 FW V2",
      "wing_area_cm2": 430,
      "wing_area_display_cm2": 430,
      "span_cm": 74,
      "aspect_ratio": 12.9,
      "weight_g": 1170,
      "item_number": "G467114",
      "level_target": [
        "pro"
      ],
      "use_case": [
        "wing-race",
        "kite-race",
        "race-grade"
      ],
      "tagline": "선수 race-grade V2 — 강풍 전용 작은 사이즈",
      "image": "https://levitaz.com/uploads/shop/levitaz_race_series_R6V1_vl1000x1000px_2024.jpg",
      "page_url": "products/levitaz/r6-race.html",
      "status": "verified",
      "why": "V2(430cm² · AR 12.9)는 V1보다 작아 강풍·고속 race 컨디션 전용. V1·V3와 동일 mast/rear-wing 호환.",
      "note": "[§170 v7 Danny 2026-05-13] Levitaz 본사 공식 spec — Area 430cm² · Span 74cm · AR 12.9 · 1170g · Item G467114. EUR €1,299 Excl VAT."
    },
    "lvz-r6-fw-v3": {
      "brand": "Levitaz",
      "model": "R6 FW V3",
      "wing_area_cm2": 530,
      "wing_area_display_cm2": 530,
      "span_cm": 87,
      "aspect_ratio": 14.3,
      "weight_g": 1322,
      "item_number": "G472585",
      "level_target": [
        "pro"
      ],
      "use_case": [
        "wing-race",
        "kite-race",
        "race-grade",
        "formula-wing"
      ],
      "tagline": "선수 race-grade V3 — FORMULA WING registered (최고 사양)",
      "image": "https://levitaz.com/uploads/shop/levitaz_race_series_R6V1_vl1000x1000px_2024.jpg",
      "page_url": "products/levitaz/r6-race.html",
      "status": "verified",
      "why": "V3(530cm² · AR 14.3 · 1322g)는 최신 race-grade. FORMULA WING registered (item G472585). V1·V2와 동일 mast/rear-wing 호환.",
      "note": "[§170 v7 Danny 2026-05-13] Levitaz 본사 공식 spec — Area 530cm² · Span 87cm · AR 14.3 · 1322g · Item G472585. EUR €1,299 Excl VAT."
    },
    "lvz-r6-mast-v1": {
      "brand": "Levitaz",
      "model": "R6 Mast V1",
      "length_cm": 90,
      "material": "UHM 카본",
      "level_target": [
        "pro"
      ],
      "tagline": "선수 race mast V1 — UHM 카본 박형",
      "image": "https://levitaz.com/uploads/shop/levitaz_race_series_R6V1_vl1000x1000px_2024.jpg",
      "page_url": "products/levitaz/r6-race.html",
      "status": "verified",
      "why": "R6 Race system 1세대 mast — Olympic 검증 race-grade UHM 카본. Wingfoil/Kite race 공통.",
      "note": "[§170 v2 Danny 2026-05-13] EUR €1,899 Excl VAT (공식 source)."
    },
    "lvz-r6-mast-v2": {
      "brand": "Levitaz",
      "model": "R6 Mast V2",
      "length_cm": 90,
      "material": "UHM 카본",
      "level_target": [
        "pro"
      ],
      "tagline": "선수 race mast V2 — UHM 카본 업데이트",
      "image": "https://levitaz.com/uploads/shop/levitaz_race_series_R6V1_vl1000x1000px_2024.jpg",
      "page_url": "products/levitaz/r6-race.html",
      "status": "verified",
      "why": "R6 Race system 2세대 mast — Wingfoil/Kite race 공통.",
      "note": "[§170 v2 Danny 2026-05-13] EUR €1,899 Excl VAT (공식 source). V1 대비 차이 (length·section·layup) Danny 검수 후 갱신."
    },
    "lvz-r6-rear-wing-v1": {
      "brand": "Levitaz",
      "model": "R6 RW V1",
      "type": "rear-wing",
      "wing_area_cm2": 172,
      "span_cm": 46,
      "aspect_ratio": 12.6,
      "weight_g": 222,
      "item_number": "G463777",
      "level_target": [
        "pro"
      ],
      "tagline": "선수 race rear wing V1 (high-AR · 약풍 race-ready)",
      "image": "https://levitaz.com/uploads/shop/levitaz_race_series_R6V1_vl1000x1000px_2024.jpg",
      "page_url": "products/levitaz/r6-race.html",
      "status": "verified",
      "why": "R6 Race system 1세대 rear wing — V2 대비 higher AR (12.6 vs 11.3), longer span (46cm vs 44cm). 약풍 race-ready.",
      "note": "[§170 v10 Danny 2026-05-13] Levitaz 본사 공식 spec — Area 172cm² · Span 46cm · AR 12.6 · 222g · Item G463777. EUR €999 Excl VAT. V1 vs V2 차이: AR 12.6/11.3, Span 46/44, Weight 222/227. V1 = light wind race-ready, V2 = stable."
    },
    "lvz-r6-rear-wing-v2": {
      "brand": "Levitaz",
      "model": "R6 RW V2",
      "type": "rear-wing",
      "wing_area_cm2": 172,
      "span_cm": 44,
      "aspect_ratio": 11.3,
      "weight_g": 227,
      "item_number": "G462363",
      "level_target": [
        "pro"
      ],
      "tagline": "선수 race rear wing V2",
      "image": "https://levitaz.com/uploads/shop/levitaz_race_series_R6V1_vl1000x1000px_2024.jpg",
      "page_url": "products/levitaz/r6-race.html",
      "status": "verified",
      "why": "R6 Race system 2세대 rear wing — Wingfoil/Kite race 공통. 172cm² · AR 11.3 · 227g.",
      "note": "[§170 v7 Danny 2026-05-13] Levitaz 본사 공식 spec — Area 172cm² · Span 44cm · AR 11.3 · 227g · Item G462363. EUR €999 Excl VAT. R6 RW V1 spec 본사 확인 필요 (TBD)."
    },
    "lvz-r6-set-v1": {
      "brand": "Levitaz",
      "model": "R6 Race Set V1",
      "type": "foil-set",
      "bundle_includes": [
        "lvz-r6-fw-v1",
        "lvz-r6-mast-v1",
        "lvz-r6-rear-wing-v1"
      ],
      "level_target": [
        "pro"
      ],
      "tagline": "R6 Race Set — FW V1 + Mast V1 + RW V1 (1세대 race-pure)",
      "image": "https://levitaz.com/uploads/shop/levitaz_race_series_R6V1_vl1000x1000px_2024.jpg",
      "page_url": "products/levitaz/r6-race.html",
      "status": "verified",
      "why": "R6 Race system 1세대 풀세트 — 선수·국가대표 1세대 조합. 가격 절약 ≈ ₩540K vs SOLO.",
      "note": "[§171 v6 Danny 2026-05-13] Canonical 산식: (€3,999 × 1800 + ₩500K) × 1.188 = ₩9,144K. SOLO 합산 ₩3,015K + ₩4,417K + ₩2,255K = ₩9,687K. Bundle 절약 ≈ ₩543K. 옛 §171 v5-critical (₩9,051K, no ship baked) SUPERSEDED. 운송 baked, cart=0."
    },
    "lvz-r6-set-v2": {
      "brand": "Levitaz",
      "model": "R6 Race Set V2",
      "type": "foil-set",
      "bundle_includes": [
        "lvz-r6-fw-v2",
        "lvz-r6-mast-v2",
        "lvz-r6-rear-wing-v2"
      ],
      "level_target": [
        "pro"
      ],
      "tagline": "R6 Race Set — FW V2 + Mast V2 + RW V2 (2세대 최신 일관)",
      "image": "https://levitaz.com/uploads/shop/levitaz_race_series_R6V1_vl1000x1000px_2024.jpg",
      "page_url": "products/levitaz/r6-race.html",
      "status": "verified",
      "why": "R6 Race system 2세대 풀세트 — 최신 강풍 전용 (FW V2 430cm²·AR 12.9). 가격 절약 ≈ ₩540K vs SOLO.",
      "note": "[§171 v6 Danny 2026-05-13] Canonical 산식: (€3,999 × 1800 + ₩500K) × 1.188 = ₩9,144K. SOLO 합산 ₩9,687K. Bundle 절약 ≈ ₩543K. 옛 §171 v5-critical SUPERSEDED. 운송 baked, cart=0."
    },
    "lvz-r6-set-mixed": {
      "brand": "Levitaz",
      "model": "R6 Race Set (Danny 권장 조합)",
      "type": "foil-set",
      "bundle_includes": [
        "lvz-r6-fw-v3",
        "lvz-r6-mast-v2",
        "lvz-r6-rear-wing-v2"
      ],
      "level_target": [
        "pro"
      ],
      "tagline": "R6 Race Set — FW V3 (FORMULA WING) + Mast V2 + RW V2",
      "image": "https://levitaz.com/uploads/shop/levitaz_race_series_R6V1_vl1000x1000px_2024.jpg",
      "page_url": "products/levitaz/r6-race.html",
      "status": "verified",
      "why": "Danny 권장 mixed 조합 — FW V3 (530cm²·AR 14.3 약풍 FORMULA) + 최신 Mast V2 + RW V2. 약풍 race-grade.",
      "note": "[§171 v6 Danny 2026-05-13] Canonical 산식: (€3,999 × 1800 + ₩500K) × 1.188 = ₩9,144K. SOLO 합산 ₩9,687K. Bundle 절약 ≈ ₩543K. 옛 §171 v5-critical SUPERSEDED. 운송 baked, cart=0."
    },
    "lvz-fs-set-540": {
      "brand": "Levitaz",
      "model": "Free Series Set FW 540",
      "type": "foil-set",
      "bundle_includes": [
        "lvz-fs540",
        "lvz-mast84",
        "lvz-stab180"
      ],
      "level_target": [
        "intermediate",
        "advanced"
      ],
      "tagline": "Free Series 풀세트 — FW 540 + Mast 84 + Stab 180",
      "image": "https://levitaz.com/uploads/shop/levitaz_free_series_frontwing_540_v2000x2000px.jpg",
      "page_url": "products/levitaz/fw-540.html",
      "status": "verified",
      "why": "FW 540 강풍·고속 윙으로 풀세트 구성. 개별 구매 대비 ₩120,000 절약 (운송 통합).",
      "note": "[§171 v10 Danny 2026-05-15] FS Set canonical — FW540 + Mast84 + Stab180. RETAIL €2564.17 (xlsx Free Series_Set Info col M, brand-price-table v5.3). Canonical 산식 (€2564.17 × 1800 + ₩500K) × 1.188 = ₩6,077K. SOLO 합산 ₩2,249K(fs540) + ₩2,849K(mast84) + ₩1,097K(stab180) = ₩6,195K. Bundle 절약 ₩118K (운송 통합 600K→500K). 운송 baked, cart=0. DO_NOT_REVERT §171 v10."
    },
    "lvz-fs-set-680": {
      "brand": "Levitaz",
      "model": "Free Series Set FW 680",
      "type": "foil-set",
      "bundle_includes": [
        "lvz-fs680",
        "lvz-mast84",
        "lvz-stab180"
      ],
      "level_target": [
        "intermediate",
        "advanced"
      ],
      "tagline": "Free Series 풀세트 — FW 680 + Mast 84 + Stab 180",
      "image": "https://levitaz.com/uploads/shop/levitaz_free_series_frontwing_790_v2000x2000px.jpg",
      "page_url": "products/levitaz/fw-680.html",
      "status": "verified",
      "why": "한국 표준 FW 680 올라운드 윙으로 풀세트 구성. 개별 구매 대비 ₩120,000 절약 (운송 통합).",
      "note": "[§171 v10 Danny 2026-05-15] FS Set canonical — FW680 + Mast84 + Stab180. RETAIL €2580.83 (xlsx Free Series_Set Info col M, brand-price-table v5.3). Canonical 산식 (€2580.83 × 1800 + ₩500K) × 1.188 = ₩6,113K. SOLO 합산 ₩2,285K(fs680) + ₩2,849K(mast84) + ₩1,097K(stab180) = ₩6,231K. Bundle 절약 ₩118K (운송 통합 600K→500K). 운송 baked, cart=0. DO_NOT_REVERT §171 v10."
    },
    "lvz-fs-set-790": {
      "brand": "Levitaz",
      "model": "Free Series Set FW 790",
      "type": "foil-set",
      "bundle_includes": [
        "lvz-fs790",
        "lvz-mast96",
        "lvz-stab180"
      ],
      "level_target": [
        "intermediate",
        "advanced"
      ],
      "tagline": "Free Series 풀세트 — FW 790 + Mast 96 + Stab 180",
      "image": "https://levitaz.com/uploads/shop/levitaz_free_series_frontwing_790_v2000x2000px.jpg",
      "page_url": "products/levitaz/fw-790.html",
      "status": "verified",
      "why": "핸들링이 쉬운 FW 790 글라이드 윙으로 풀세트 구성. 개별 구매 대비 ₩120,000 절약 (운송 통합).",
      "note": "[§171 v10 Danny 2026-05-15] FS Set canonical — FW790 + Mast96 + Stab180. RETAIL €2747.50 (xlsx Free Series_Set Info col M, brand-price-table v5.3). Canonical 산식 (€2747.50 × 1800 + ₩500K) × 1.188 = ₩6,469K. SOLO 합산 ₩2,463K(fs790) + ₩3,028K(mast96) + ₩1,097K(stab180) = ₩6,588K. Bundle 절약 ₩119K (운송 통합 600K→500K). 운송 baked, cart=0. DO_NOT_REVERT §171 v10."
    },
    "lvz-fs-set-900": {
      "brand": "Levitaz",
      "model": "Free Series Set FW 900",
      "type": "foil-set",
      "bundle_includes": [
        "lvz-fs900",
        "lvz-mast96",
        "lvz-stab180"
      ],
      "level_target": [
        "intermediate",
        "advanced"
      ],
      "tagline": "Free Series 풀세트 — FW 900 + Mast 96 + Stab 180",
      "image": "https://levitaz.com/uploads/shop/levitaz_free_series_frontwing_900_v2000x2000px.jpg",
      "page_url": "products/levitaz/fw-900.html",
      "status": "verified",
      "why": "미풍 특화 FW 900 윙으로 풀세트 구성. 개별 구매 대비 ₩120,000 절약 (운송 통합).",
      "note": "[§171 v10 Danny 2026-05-15] FS Set canonical — FW900 + Mast96 + Stab180. RETAIL €2789.17 (xlsx Free Series_Set Info col M, brand-price-table v5.3). Canonical 산식 (€2789.17 × 1800 + ₩500K) × 1.188 = ₩6,558K. SOLO 합산 ₩2,552K(fs900) + ₩3,028K(mast96) + ₩1,097K(stab180) = ₩6,677K. Bundle 절약 ₩119K (운송 통합 600K→500K). 운송 baked, cart=0. DO_NOT_REVERT §171 v10."
    }
  },
  "boards": {
    "lvz-boom-fs63": {
      "brand": "Levitaz",
      "model": "Boom FS 63",
      "volume_l": 63,
      "length_cm": 150,
      "width_cm": 45,
      "level_target": [
        "advanced",
        "pro"
      ],
      "tagline": "Sporty·direct — 상급 전용 sinker",
      "image": "https://levitaz.com/uploads/shop/levitaz-boom-44-wing-foil-board-product-single-1000x1000px.jpg",
      "page_url": "levitaz.html#boom-fs63",
      "status": "verified",
      "why": "63L 상급 보드. 반응이 즉각적, Mathis Ghio 등 Levitaz 국가대표 라이더 선호.",
      "levitaz_canonical_name": "BOOM RS SCC 63",
      "note": "[§170 v11 Danny 2026-05-13] Levitaz 공식 = 'BOOM RS SCC 63'. 단무지 약식 = 'Boom FS 63' (동일 제품, naming 통일)."
    },
    "lvz-boom-fs83": {
      "brand": "Levitaz",
      "model": "Boom FS 83",
      "volume_l": 83,
      "length_cm": 170,
      "width_cm": 48.1,
      "level_target": [
        "intermediate",
        "advanced"
      ],
      "tagline": "All-round sweet spot — 가장 무난한 선택",
      "image": "https://levitaz.com/uploads/shop/levitaz-boom-75-wing-foil-board-product-single-1000x1000px.jpg",
      "page_url": "levitaz.html#boom-fs83",
      "status": "verified",
      "why": "83L 1년→2년차 표준 보드. jibe·tack 정복 단계에 딱.",
      "levitaz_canonical_name": "BOOM RS SCC 83",
      "note": "[§170 v11 Danny 2026-05-13] Levitaz 공식 = 'BOOM RS SCC 83'. 단무지 약식 = 'Boom FS 83' (동일 제품)."
    },
    "lvz-boom-fs95": {
      "brand": "Levitaz",
      "model": "Boom FS 95",
      "volume_l": 95,
      "length_cm": 194,
      "width_cm": 48,
      "level_target": [
        "intermediate",
        "advanced",
        "pro"
      ],
      "tagline": "미풍 레이스보드 — 중급-선수 · 미풍레이싱·다운윈드·하이브리드",
      "image": "https://levitaz.com/uploads/shop/levitaz-boom-94-wing-foil-board-product-single-1000x1000px_2021-05-03-095914.jpg",
      "page_url": "levitaz.html#boom-fs95",
      "status": "verified",
      "why": "95L 부력이 만드는 안정성으로 미풍에서도 일찍 떠오르는 레이스보드. 다운윈드·하이브리드까지 한 보드로 cover.",
      "levitaz_canonical_name": "BOOM RS SCC 95",
      "note": "[§170 v11 Danny 2026-05-13] Levitaz 공식 = 'BOOM RS SCC 95'. 단무지 약식 = 'Boom FS 95' (동일 제품)."
    },
    "takoon-cruise": {
      "brand": "Takoon",
      "model": "Cruise",
      "category": "wingfoil-entry",
      "level_target": [
        "beginner"
      ],
      "tagline": "입문·초급 cross-category — 모든 카테고리 입문 시 추천",
      "sizes_ft": [
        "5'4\"",
        "5'10\"",
        "6'2\"",
        "6'10\"",
        "7'2\""
      ],
      "volume_range_l": "75–145L (size별)",
      "image": "https://cdn.shopify.com/s/files/1/2503/9576/files/Cruise_1200x1200_07dc0705-315a-473f-b9c6-e76ee9237a06.png",
      "page_url": "takoon.html#cruise",
      "status": "verified",
      "why": "윙포일 첫 보드의 정석. 5'6~6'0, 입문·초급 학습이 자연스럽습니다.",
      "note": "Cruise 3 사이즈 takoon-full-spec.json EUR canonical (€649/€699/€699). §171 v5-critical (Danny 2026-05-13) — RETAIL_EUR × 1800 × 1.188 only · 운송 cart.js 별도.",
      "size_pricing_KRW": {
        "5'6": 1980000,
        "5'10": 1960000,
        "6'0":2090000
      },
      "size_pricing_EUR": {
        "5'6": 649,
        "5'10": 699,
        "6'0": 699
      },
      "_v54_updated": "§171 v6 canonical (Danny 2026-05-13): (KRW + ship) × 1.188, ship baked, cart=0",
      "_v54_corrected": "옛 값 1,980K~2,087K (shipping ₩500K 더블링·EUR base 648/639/698 vs canonical 649/699/699) → 정정",
      "site_url": "https://takoon.com (Cruise product page)",
      "verified_invoice": {
        "size": "5'10 110L"
      }
    },
    "takoon-slide": {
      "brand": "Takoon",
      "model": "Slide",
      "category": "parawing",
      "level_target": [
        "intermediate",
        "advanced"
      ],
      "tagline": "패러윙 (Parawing) 전용 midlength",
      "sizes_ft": [
        "5'4\"",
        "5'10\"",
        "6'4\"",
        "7'0\""
      ],
      "volume_range_l": "50–120L",
      "image": "https://cdn.shopify.com/s/files/1/2503/9576/files/Slide-6_0-Board---main-Bigger.png",
      "page_url": "takoon.html#slide",
      "status": "verified",
      "why": "Parawing·일반 wingfoil 모두 OK. 5'4~7'0 사이즈 폭 넓어 자기 size 찾기 쉬워요.",
      "note": "[Danny review] Parawing·일반 wing 호환 board family. EUR canonical takoon-full-spec.json (5'4=€999, 5'9/6'0=€999, 6'3=€1049, 6'6-7'0=€1149).",
      "size_pricing_KRW": {
        "5'4":3150000,
        "5'10": 2730000,
        "6'4":2840000,
        "7'0":3050000
      },
      "size_pricing_EUR": {
        "5'4": 999,
        "5'10": 999,
        "6'4": 1049,
        "7'0": 1149
      },
      "_v54_updated": "§171 v6 canonical (Danny 2026-05-13): (KRW + ship) × 1.188, ship baked, cart=0",
      "_v54_corrected": "옛 값 3,156K~3,581K (shipping ₩500K 더블링·EUR base 누락) → 정정"
    },
    "takoon-glide-midlength": {
      "brand": "Takoon",
      "model": "Glide Midlength",
      "category": "hybrid-wing-dw-sup",
      "level_target": [
        "intermediate",
        "advanced"
      ],
      "tagline": "Hybrid versatile — Wing/Downwind/SUP 다목적",
      "sizes_ft": [
        "5'8\"",
        "6'2\"",
        "6'8\"",
        "7'2\""
      ],
      "volume_range_l": "80–135L",
      "image": "https://cdn.shopify.com/s/files/1/2503/9576/files/Glide-Midlength---White-6_0---Image-01.png",
      "page_url": "takoon.html#glide-midlength",
      "status": "verified",
      "why": "longboard 안정성 + glide 속도감 합친 midlength. 가족 라이딩 추천.",
      "note": "[Danny review] Wing/DW/SUP cross-category midlength. EUR canonical (5'8=€999, 6'4=€1099 [6'2 nearest], 6'8=€1149, 7'2=€1169).",
      "size_pricing_KRW": {
        "5'8":2730000,
        "6'2":2940000,
        "6'8":3050000,
        "7'2": 3090000
      },
      "size_pricing_EUR": {
        "5'8": 999,
        "6'2": 1099,
        "6'8": 1149,
        "7'2": 1169
      },
      "_v54_updated": "§171 v6 canonical (Danny 2026-05-13): (KRW + ship) × 1.188, ship baked, cart=0",
      "_v54_corrected": "옛 값 3,156K~3,517K (shipping 더블링) → 정정"
    },
    "takoon-glide": {
      "brand": "Takoon",
      "model": "Glide",
      "category": "wingfoil-freeride",
      "level_target": [
        "intermediate",
        "advanced"
      ],
      "tagline": "윙포일/프리라이드 — versatile freeride·wave·race",
      "sizes_ft": [
        "4'9\"",
        "5'0\"",
        "5'2\"",
        "5'4\"",
        "5'6\"",
        "5'8\""
      ],
      "volume_range_l": "45–105L",
      "image": "https://cdn.shopify.com/s/files/1/2503/9576/files/Glide-5_0-White---Image-01_bigger_cd0d5cfe-0e37-4266-951d-0f5d8540530a.png",
      "page_url": "takoon.html#glide",
      "status": "verified",
      "why": "중급~상급 freeride 표준. 2026 디테일 업데이트로 더 매끄럽게.",
      "note": "[Danny review] freeride 표준 board (versatile). EUR canonical takoon-full-spec.json Glide (4'9=€949, 5'0/5'2=€999, 5'4/5'6/5'8=€1049). 옛 5'10~7'2 legacy 사이즈 = Glide Midlength 매핑 권장.",
      "size_pricing_KRW": {
        "4'9":2620000,
        "5'0":2730000,
        "5'2":2730000,
        "5'4":2840000,
        "5'6":2840000,
        "5'8":2840000
      },
      "size_pricing_EUR": {
        "4'9": 949,
        "5'0": 999,
        "5'2": 999,
        "5'4": 1049,
        "5'6": 1049,
        "5'8": 1049
      },
      "_v54_updated": "§171 v6 canonical (Danny 2026-05-13): (KRW + ship) × 1.188, ship baked, cart=0",
      "_v54_corrected": "옛 값 3,263K~3,517K (shipping 더블링) → RETAIL_EUR × 1800 × 1.188 only"
    },
    "takoon-ultra-glide": {
      "brand": "Takoon",
      "model": "Ultra Glide",
      "category": "downwind-sup-foil",
      "level_target": [
        "intermediate",
        "advanced"
      ],
      "tagline": "다운윈드 / SUP 포일 전용",
      "sizes_ft": [
        "5'8\"",
        "6'2\"",
        "6'6\"",
        "7'0\"",
        "7'4\""
      ],
      "volume_range_l": "60–140L",
      "image": "https://cdn.shopify.com/s/files/1/2503/9576/files/Ultra-Glide-6_6-White---Image-01_bigger.png",
      "page_url": "takoon.html#ultra-glide",
      "status": "verified",
      "why": "다운윈드 SUP foil 전용. paddle-up 쉽고 약풍 day의 무한 glide.",
      "note": "[Danny review] DW·SUP foil 전용 long board. EUR canonical (5'8=€999, 6'2=€1099, 6'6=€1149, 7'0=€1149, 7'4=€1169).",
      "size_pricing_KRW": {
        "5'8":2730000,
        "6'2": 2940000,
        "6'6":3050000,
        "7'0":3050000,
        "7'4": 3090000
      },
      "size_pricing_EUR": {
        "5'8": 999,
        "6'2": 1099,
        "6'6": 1149,
        "7'0": 1149,
        "7'4": 1169
      },
      "_v54_updated": "§171 v6 canonical (Danny 2026-05-13): (KRW + ship) × 1.188, ship baked, cart=0",
      "_v54_corrected": "옛 값 3,156K~3,517K (shipping 더블링) → 정정"
    },
    "takoon-prosurf": {
      "brand": "Takoon",
      "model": "Prosurf",
      "category": "pumping-surf-foil",
      "level_target": [
        "intermediate",
        "advanced"
      ],
      "tagline": "펌핑포일 / 서핑포일 — wave 라이딩 전용",
      "sizes_ft": [
        "4'10\"",
        "5'0\"",
        "5'4\"",
        "5'8\""
      ],
      "volume_range_l": "30–75L",
      "image": "https://cdn.shopify.com/s/files/1/2503/9576/files/Prosurf_bigger.png",
      "page_url": "takoon.html#prosurf",
      "status": "verified",
      "why": "wave foil 컴팩트 보드. 일반 spot 작은 파도부터 즐겨요.",
      "note": "[Danny review] pump foil·surf foil wave board. EUR canonical Prosurf (4'10=€949, 5'0=€949, max 5'2=€1049 → 5'4·5'8 = €1049 ceiling legacy size).",
      "size_pricing_KRW": {
        "4'10":2620000,
        "5'0":2620000,
        "5'4":2840000,
        "5'8":2840000
      },
      "size_pricing_EUR": {
        "4'10": 949,
        "5'0": 949,
        "5'4": 1049,
        "5'8": 1049
      },
      "_v54_updated": "§171 v6 canonical (Danny 2026-05-13): (KRW + ship) × 1.188, ship baked, cart=0",
      "_v54_corrected": "옛 값 3,049K~3,263K (shipping 더블링) → RETAIL_EUR × 1800 × 1.188 only"
    }
  },
  "accessories": {
    "wip-impact-vest": {
      "brand": "Forward WIP",
      "model": "Kompact Vest 2.0",
      "category": "vest",
      "level_target": [
        "beginner",
        "intermediate",
        "advanced"
      ],
      "tagline": "낙상·foil 충돌 보호",
      "image": "https://cdn.shopify.com/s/files/1/0279/4022/5124/products/kompact.jpg",
      "page_url": "wip.html#impact-vest",
      "status": "verified",
      "why": "EN ISO 12402-5 50N 인증. 안전과 동작성 모두 잡았어요.",
      "in_stock": true,
      "ordered_classif": [
        "BODY SAFETY"
      ],
      "ordered_sku_examples": [
        "A-02171 KOMPACT VEST 50N 2.0 (S)",
        "A-02172 KOMPACT VEST 50N 2.0 (M)",
        "A-02173 KOMPACT VEST 50N 2.0 (L)",
        "A-01824/25/26 WING IMPACT VEST 50N (S/M/L)",
        "A-01981/82/83 RALEY IMPACT VEST BLACK CAMO (S/M/L)"
      ],
      "note": "BODY SAFETY 11 SKU · 15 units 발주 — 가장 라인업 두꺼운 카테고리",
      "ordered_sku_count": 5
    },
    "wip-helmet": {
      "brand": "Forward WIP",
      "model": "WiFLEX Pro Helmet",
      "category": "helmet",
      "level_target": [
        "beginner",
        "intermediate",
        "advanced",
        "pro"
      ],
      "tagline": "수상 전용 헬멧",
      "image": "https://cdn.shopify.com/s/files/1/0279/4022/5124/products/7.PROWIP2.0HELMET-MATRED.jpg",
      "page_url": "wip.html#helmet",
      "status": "verified",
      "why": "프로레벨 수상 헬멧. EPS 쉘로 충격 흡수 강화.",
      "in_stock": true,
      "ordered_classif": [
        "HEAD SAFETY"
      ],
      "ordered_sku_examples": [
        "A-02212 X-OVER NEW YELLOW HIGH VIS",
        "A-00981 X-OVER VISOR EVO ORANGE NEON",
        "A-01576/01846 PROWIP 2.0 STEALTH BLACK (M-L/S-M)",
        "A-00720/02004 PROWIP 2.0 MAT WHITE (M-L/S-M)",
        "A-01787/88 WIFLEX PRO 2.0 HIGH VIS (M-L/S-M)",
        "A-02213/15 COOL CAP NEW BLACK CAMO·SUNSET FADING"
      ],
      "note": "HEAD SAFETY 20 SKU · 27 units 발주 — 헬멧·범프 캡 풀라인",
      "ordered_sku_count": 6
    },
    "wip-harness": {
      "brand": "Forward WIP",
      "model": "Waist Harness",
      "category": "harness",
      "level_target": [
        "intermediate",
        "advanced",
        "pro"
      ],
      "tagline": "장시간 라이딩 — 팔 피로 감소",
      "image": "",
      "page_url": "wip.html#harness",
      "status": "verified",
      "why": "윙포일 등 통증 한 방에. 70~110cm 조절, 1시간+ 라이딩 차이 확실.",
      "in_stock": true,
      "ordered_classif": [
        "HARNESSES"
      ],
      "ordered_sku_examples": [
        "A-01535/36 WAISTFOIL HARNESS 3.0 (S-M/L-XL · 각 5pc)",
        "A-02200 WING WIND PRO HARNESS S-M"
      ],
      "note": "HARNESSES 3 SKU · 11 units 발주 — Waistfoil 양 size 5pc씩 강세",
      "ordered_sku_count": 2
    },
    "wip-wetsuit-32": {
      "brand": "Forward WIP",
      "model": "Flash 3/2mm Wetsuit",
      "category": "wetsuit",
      "level_target": [
        "beginner",
        "intermediate",
        "advanced",
        "pro"
      ],
      "tagline": "봄·가을 한국 4계절 cover",
      "image": "https://cdn.shopify.com/s/files/1/0279/4022/5124/products/longsleeverash.jpg",
      "page_url": "wip.html#wetsuit",
      "status": "verified",
      "why": "여름 spot UV 차단 + 빠른 건조. 6~9월 거의 매일 입게 돼요.",
      "in_stock": true,
      "ordered_classif": [
        "WETSUITS"
      ],
      "ordered_sku_examples": [
        "A-01486 STEAMY PO (M)",
        "A-01491 STEAM CO (M)",
        "A-01352/53/56 SUMMER NEO LONG JOHN MK2 GREY (M/L · WOMEN S)"
      ],
      "note": "봄·가을 3/2mm 라인. STEAMY·STEAM·SUMMER NEO LONG JOHN.",
      "ordered_sku_count": 3
    },
    "wip-wetsuit-43": {
      "brand": "Forward WIP",
      "model": "Flash 4/3mm Wetsuit",
      "category": "wetsuit",
      "level_target": [
        "beginner",
        "intermediate",
        "advanced",
        "pro"
      ],
      "tagline": "겨울·이른 봄 — 한국 winter",
      "image": "https://cdn.shopify.com/s/files/1/0279/4022/5124/products/1.3DSNEOTOP3MM.jpg",
      "page_url": "wip.html#wetsuit-winter",
      "status": "verified",
      "why": "쌀쌀한 봄·가을용 3D-cut 3mm 네오프렌. 체감상 더 따뜻.",
      "in_stock": true,
      "ordered_classif": [
        "WETSUITS"
      ],
      "ordered_sku_examples": [
        "A-01481 STEAMER MK3 (M)",
        "A-02190 STEAMY LS BLACK CAMO (M)",
        "A-00210 HYBRID SEMI DRY BLACK (M)",
        "A-01320/21/23 NEO LONG JOHN MK2 (M/L · WOMEN S)"
      ],
      "note": "겨울·이른 봄 4/3mm 라인 + 풀스팀.",
      "ordered_sku_count": 4
    }
  }
};
