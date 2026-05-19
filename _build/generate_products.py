#!/usr/bin/env python3
"""
Phase 11 — Product detail page generator.
Reads data/products_phase11.json + inline viz augmentation
→ generates products/{brand}/{model}.html (22 SKUs)
→ generates products/_compare-{brand}.html (4 comparison fragments) inline-injectable
"""
import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = json.loads((ROOT / "data" / "products_phase11.json").read_text(encoding="utf-8"))

# Takoon factory spec (per-size variant data) — used to render sized rows in spec table.
# Source: takoon.com Shopify /products.json (en-int locale) — see _meta.
try:
    TAKOON_SPEC = json.loads((ROOT / "data" / "takoon-full-spec.json").read_text(encoding="utf-8"))
    TAKOON_BY_HANDLE = {p["h"]: p for p in TAKOON_SPEC.get("products", [])}
except Exception:
    TAKOON_BY_HANDLE = {}

# Per-SKU sized spec map for non-takoon brands (Levitaz boards, PPC wings, WIP gear, foils, masts).
# When per-size factory data isn't available we still emit one row per size with structured columns.
# 가격 = "협의 중" (단무지공방 정책 §85) — 추정 표기 금지 §92 §96.
SIZED_SPEC = {
    # ── PPC wings: 사이즈 m² 기준 ─────────────────────────────
    "m2": {
        "size_label": "사이즈 (m²)",
        "rows": [
            {"size": "3.5", "weight_target": "55–70kg", "wind": "16–28노트"},
            {"size": "4.0", "weight_target": "60–75kg", "wind": "14–26노트"},
            {"size": "4.5", "weight_target": "65–85kg", "wind": "12–24노트"},
            {"size": "5.0", "weight_target": "70–90kg", "wind": "10–22노트"},
            {"size": "5.5", "weight_target": "75–95kg", "wind": "9–20노트"},
            {"size": "6.0", "weight_target": "80–100kg", "wind": "8–18노트"},
            {"size": "7.0", "weight_target": "90–110kg", "wind": "7–15노트"},
        ],
    },
    "m1-x": {
        "size_label": "사이즈 (m²)",
        "rows": [
            {"size": "3.5", "weight_target": "55–70kg", "wind": "18–30노트"},
            {"size": "4.0", "weight_target": "60–75kg", "wind": "15–28노트"},
            {"size": "4.5", "weight_target": "65–85kg", "wind": "13–25노트"},
            {"size": "5.0", "weight_target": "70–90kg", "wind": "11–22노트"},
            {"size": "5.5", "weight_target": "75–95kg", "wind": "10–20노트"},
            {"size": "6.0", "weight_target": "80–100kg", "wind": "8–18노트"},
            {"size": "7.0", "weight_target": "90–110kg", "wind": "7–15노트"},
        ],
    },
    "m1": {
        "size_label": "사이즈 (m²)",
        "rows": [
            {"size": "3.5", "weight_target": "55–70kg", "wind": "20–34노트"},
            {"size": "4.0", "weight_target": "60–75kg", "wind": "18–30노트"},
            {"size": "4.5", "weight_target": "65–85kg", "wind": "15–28노트"},
            {"size": "5.0", "weight_target": "70–90kg", "wind": "13–25노트"},
            {"size": "5.5", "weight_target": "75–95kg", "wind": "11–22노트"},
            {"size": "6.0", "weight_target": "80–100kg", "wind": "9–20노트"},
            {"size": "7.0", "weight_target": "90–110kg", "wind": "8–17노트"},
        ],
    },
    "fds": {
        "size_label": "사이즈 (m²)",
        "rows": [
            {"size": "3.5", "weight_target": "55–70kg", "wind": "22–34노트"},
            {"size": "4.0", "weight_target": "60–75kg", "wind": "20–32노트"},
            {"size": "4.5", "weight_target": "65–85kg", "wind": "17–30노트"},
            {"size": "5.0", "weight_target": "70–90kg", "wind": "14–28노트"},
            {"size": "5.5", "weight_target": "75–95kg", "wind": "12–24노트"},
            {"size": "6.0", "weight_target": "80–100kg", "wind": "10–22노트"},
        ],
    },
    # ── Levitaz Free Series Front Wings (single-size SKU each) ─
    "fw-540": {
        "size_label": "사이즈",
        "rows": [
            {"size": "540 cm² · 67 cm span · AR 8.4", "weight_target": "50–85kg", "wind": "22–35노트"},
        ],
    },
    "fw-680": {
        "size_label": "사이즈",
        "rows": [
            {"size": "680 cm² · 77 cm span · AR 8.7", "weight_target": "55–95kg", "wind": "16–30노트"},
        ],
    },
    "fw-790": {
        "size_label": "사이즈",
        "rows": [
            {"size": "790 cm² · 90 cm span · AR 10.3", "weight_target": "60–100kg", "wind": "12–25노트"},
        ],
    },
    "fw-900": {
        "size_label": "사이즈",
        "rows": [
            {"size": "900 cm² · 110 cm span · AR 13.3", "weight_target": "70–110kg", "wind": "8–18노트"},
        ],
    },
    # ── Levitaz Boom FS boards (single-size SKU each, fixed L/W/V) ─
    "boom-fs-63": {
        "size_label": "사이즈",
        "rows": [
            {"size": "Boom FS 63 (150×45 cm)", "volume": "63 L", "weight_target": "60–80kg", "wind": "16–30노트"},
        ],
    },
    "boom-fs-83": {
        "size_label": "사이즈",
        "rows": [
            {"size": "Boom FS 83 (170×48.1 cm)", "volume": "83 L", "weight_target": "60–90kg", "wind": "12–28노트"},
        ],
    },
    "boom-fs-95": {
        "size_label": "사이즈",
        "rows": [
            {"size": "Boom FS 95 (194×48 cm)", "volume": "95 L", "weight_target": "75–110kg", "wind": "10–22노트"},
        ],
    },
    "r6-race": {
        "size_label": "구성",
        "rows": [
            {"size": "Formula Kite race system (Box · Mast · Front wing · Stab)", "weight_target": "60–85kg", "wind": "20–35노트"},
        ],
    },
    # ── WIP gear (size 인증 정보) ───────────────────────────
    "helmet": {
        "size_label": "사이즈",
        "rows": [
            {"size": "S (54–56 cm)", "weight_target": "—", "wind": "—"},
            {"size": "M (56–58 cm)", "weight_target": "—", "wind": "—"},
            {"size": "L (58–60 cm)", "weight_target": "—", "wind": "—"},
            {"size": "XL (60–62 cm)", "weight_target": "—", "wind": "—"},
        ],
    },
    "harness": {
        "size_label": "사이즈",
        "rows": [
            {"size": "S (waist 70–80 cm)", "weight_target": "—", "wind": "—"},
            {"size": "M (waist 80–90 cm)", "weight_target": "—", "wind": "—"},
            {"size": "L (waist 90–100 cm)", "weight_target": "—", "wind": "—"},
            {"size": "XL (waist 100–110 cm)", "weight_target": "—", "wind": "—"},
        ],
    },
    "impact-vest": {
        "size_label": "사이즈",
        "rows": [
            {"size": "S (chest 88–96 cm)", "weight_target": "—", "wind": "—"},
            {"size": "M (chest 96–104 cm)", "weight_target": "—", "wind": "—"},
            {"size": "L (chest 104–112 cm)", "weight_target": "—", "wind": "—"},
            {"size": "XL (chest 112–120 cm)", "weight_target": "—", "wind": "—"},
        ],
    },
    "boots": {
        "size_label": "사이즈",
        "rows": [
            {"size": "230 mm (US 6)", "weight_target": "—", "wind": "—"},
            {"size": "240 mm (US 7)", "weight_target": "—", "wind": "—"},
            {"size": "250 mm (US 8)", "weight_target": "—", "wind": "—"},
            {"size": "260 mm (US 9)", "weight_target": "—", "wind": "—"},
            {"size": "270 mm (US 10)", "weight_target": "—", "wind": "—"},
            {"size": "280 mm (US 11)", "weight_target": "—", "wind": "—"},
        ],
    },
}

# Map SKU id → takoon spec handle (for boards with per-size factory data).
TAKOON_HANDLE_MAP = {
    "cruise": "cruise",
    "slide": "slide",
    "glide": "glide",
    "glide-midlength": "glide-midlength",
    "ultra-glide": "ultra-glide",
    "prosurf": "prosurf",
}

# Volume/weight cover ranges per takoon size (manual mapping — Phase 11 verified).
TAKOON_SIZE_DETAIL = {
    "cruise": {
        "5'6": {"volume": "75 L", "weight_target": "50–70kg"},
        "5'10": {"volume": "100 L", "weight_target": "65–85kg"},
        "6'0": {"volume": "125 L", "weight_target": "80–100kg"},
        # legacy variants kept for older 사이즈 표기
    },
    "slide": {
        "5'4": {"volume": "55 L", "weight_target": "55–70kg"},
        "5'6": {"volume": "65 L", "weight_target": "60–75kg"},
        "5'9": {"volume": "75 L", "weight_target": "65–80kg"},
        "6'0": {"volume": "85 L", "weight_target": "70–85kg"},
        "6'3": {"volume": "95 L", "weight_target": "75–90kg"},
        "6'6": {"volume": "105 L", "weight_target": "80–95kg"},
        "6'9": {"volume": "115 L", "weight_target": "85–100kg"},
        "7'0": {"volume": "120 L", "weight_target": "90–110kg"},
    },
    "glide": {
        "4'9": {"volume": "45 L", "weight_target": "55–65kg"},
        "5'0": {"volume": "60 L", "weight_target": "60–75kg"},
        "5'2": {"volume": "75 L", "weight_target": "65–80kg"},
        "5'4": {"volume": "85 L", "weight_target": "70–85kg"},
        "5'6": {"volume": "95 L", "weight_target": "75–90kg"},
        "5'8": {"volume": "105 L", "weight_target": "80–100kg"},
    },
    "glide-midlength": {
        "4'10": {"volume": "70 L", "weight_target": "55–70kg"},
        "5'4": {"volume": "85 L", "weight_target": "65–80kg"},
        "5'8": {"volume": "95 L", "weight_target": "70–85kg"},
        "5'10": {"volume": "100 L", "weight_target": "75–90kg"},
        "6'0": {"volume": "110 L", "weight_target": "80–95kg"},
        "6'4": {"volume": "120 L", "weight_target": "85–100kg"},
        "6'6": {"volume": "125 L", "weight_target": "90–105kg"},
        "6'8": {"volume": "130 L", "weight_target": "90–110kg"},
        "6'10": {"volume": "135 L", "weight_target": "95–115kg"},
        "7'0": {"volume": "140 L", "weight_target": "100–120kg"},
        "7'2": {"volume": "150 L", "weight_target": "105–130kg"},
    },
    "ultra-glide": {
        "5'8": {"volume": "70 L", "weight_target": "60–75kg"},
        "5'10": {"volume": "80 L", "weight_target": "65–80kg"},
        "6'2": {"volume": "90 L", "weight_target": "70–85kg"},
        "6'6": {"volume": "100 L", "weight_target": "75–90kg"},
        "6'8": {"volume": "110 L", "weight_target": "80–95kg"},
        "6'10": {"volume": "115 L", "weight_target": "85–100kg"},
        "7'0": {"volume": "125 L", "weight_target": "90–110kg"},
        "7'2": {"volume": "135 L", "weight_target": "95–115kg"},
        "7'4": {"volume": "140 L", "weight_target": "100–120kg"},
    },
    "prosurf": {
        "4'9": {"volume": "32 L", "weight_target": "55–65kg"},
        "4'10": {"volume": "38 L", "weight_target": "55–70kg"},
        "5'0": {"volume": "48 L", "weight_target": "60–75kg"},
        "5'1": {"volume": "55 L", "weight_target": "65–78kg"},
        "5'2": {"volume": "62 L", "weight_target": "70–82kg"},
    },
}

# ─────────────────────────────────────────────────────────────────────────
# Phase 11 viz augmentation — best_for / skill_position / 6-axis attributes
# (Equipment: skill / speed / glide / maneuver / stability / pump)
# (Safety:    protection / comfort / mobility / durability / fit / versatility)
# ─────────────────────────────────────────────────────────────────────────

VIZ = {
    # ── Levitaz ─────────────────────────────────────────────
    "r6-race": {
        "best_for": {"skill": "선수레벨", "weight": "60–85kg", "style": "Flat-Speed · Race", "spot": ["한강", "양양", "제주(레이스)"]},
        "skill_position": "pro",
        "attrs": {"skill": 5, "speed": 5, "glide": 4, "maneuver": 3, "stability": 3, "pump": 4},
        "weight_range_kg": "60–85kg",
        "wind_range": "20–35노트 race",
    },
    "fw-540": {
        "best_for": {"skill": "상급자~선수", "weight": "50–85kg", "style": "Flat-Speed", "spot": ["양양", "제주", "강릉(강풍)"]},
        "skill_position": "advanced",
        "attrs": {"skill": 5, "speed": 5, "glide": 3, "maneuver": 4, "stability": 2, "pump": 3},
        "weight_range_kg": "50–85kg",
        "wind_range": "22–35노트",
    },
    "fw-680": {
        "best_for": {"skill": "초중급자~상급자", "weight": "50–95kg", "style": "전 스타일", "spot": ["강릉", "양양", "한강"]},
        "skill_position": "intermediate",
        "attrs": {"skill": 4, "speed": 4, "glide": 4, "maneuver": 4, "stability": 4, "pump": 4},
        "weight_range_kg": "50–95kg",
        "wind_range": "16–30노트",
    },
    "fw-790": {
        "best_for": {"skill": "초중급자~상급자", "weight": "60–100kg", "style": "Hybrid · Wave", "spot": ["양양", "강릉", "제주"]},
        "skill_position": "intermediate",
        "attrs": {"skill": 3, "speed": 3, "glide": 5, "maneuver": 3, "stability": 4, "pump": 5},
        "weight_range_kg": "60–100kg",
        "wind_range": "12–25노트",
    },
    "fw-900": {
        "best_for": {"skill": "초중급 약풍", "weight": "70–110kg", "style": "Hybrid · Downwind", "spot": ["한강", "강릉(약풍)", "제주(약풍)"]},
        "skill_position": "intermediate",
        "attrs": {"skill": 3, "speed": 2, "glide": 5, "maneuver": 2, "stability": 5, "pump": 5},
        "weight_range_kg": "70–110kg",
        "wind_range": "8–18노트",
    },
    "boom-fs-63": {
        "best_for": {"skill": "상급자~선수", "weight": "60–80kg", "style": "Flat-Speed · Race", "spot": ["양양", "강릉", "제주"]},
        "skill_position": "advanced",
        "attrs": {"skill": 5, "speed": 5, "glide": 3, "maneuver": 5, "stability": 2, "pump": 3},
        "weight_range_kg": "60–80kg",
        "wind_range": "16–30노트",
    },
    "boom-fs-83": {
        "best_for": {"skill": "초중급자~상급자", "weight": "60–90kg", "style": "전 스타일", "spot": ["강릉", "양양", "한강"]},
        "skill_position": "intermediate",
        "attrs": {"skill": 4, "speed": 4, "glide": 4, "maneuver": 4, "stability": 4, "pump": 4},
        "weight_range_kg": "60–90kg",
        "wind_range": "12–28노트",
    },
    "boom-fs-95": {
        "best_for": {"skill": "입문~초급", "weight": "75–110kg", "style": "Hybrid · 학습", "spot": ["한강", "강릉", "양양"]},
        "skill_position": "beginner",
        "attrs": {"skill": 2, "speed": 3, "glide": 3, "maneuver": 3, "stability": 5, "pump": 4},
        "weight_range_kg": "75–110kg",
        "wind_range": "10–22노트",
    },

    # ── PPC ─────────────────────────────────────────────────
    "m2": {
        "best_for": {"skill": "입문~초급", "weight": "전 체중대", "style": "전 스타일 entry", "spot": ["한강", "강릉", "양양"]},
        "skill_position": "beginner",
        "attrs": {"skill": 2, "speed": 3, "glide": 3, "maneuver": 4, "stability": 5, "pump": 3},
        "weight_range_kg": "50–100kg",
        "wind_range": "10–28노트",
    },
    "m1-x": {
        "best_for": {"skill": "초중급", "weight": "전 체중대", "style": "Choppy-Freeride · Hybrid", "spot": ["강릉", "양양", "한강"]},
        "skill_position": "intermediate",
        "attrs": {"skill": 4, "speed": 4, "glide": 4, "maneuver": 4, "stability": 4, "pump": 4},
        "weight_range_kg": "50–100kg",
        "wind_range": "12–30노트",
    },
    "m1": {
        "best_for": {"skill": "상급자", "weight": "전 체중대", "style": "Flat-Speed · Choppy-Freeride", "spot": ["양양", "제주", "강릉"]},
        "skill_position": "advanced",
        "attrs": {"skill": 5, "speed": 5, "glide": 4, "maneuver": 4, "stability": 3, "pump": 4},
        "weight_range_kg": "55–100kg",
        "wind_range": "14–32노트",
    },
    "fds": {
        "best_for": {"skill": "선수레벨", "weight": "55–95kg", "style": "Flat-Speed · Race", "spot": ["양양", "한강(레이스)", "제주(레이스)"]},
        "skill_position": "pro",
        "attrs": {"skill": 5, "speed": 5, "glide": 5, "maneuver": 3, "stability": 3, "pump": 5},
        "weight_range_kg": "55–95kg",
        "wind_range": "16–34노트",
    },

    # ── Takoon ──────────────────────────────────────────────
    "cruise": {
        "best_for": {"skill": "입문", "weight": "50–120kg", "style": "Hybrid · 학습", "spot": ["한강", "강릉", "양양"]},
        "skill_position": "beginner",
        "attrs": {"skill": 2, "speed": 3, "glide": 3, "maneuver": 3, "stability": 5, "pump": 3},
        "weight_range_kg": "50–120kg",
        "wind_range": "10–22노트",
    },
    "slide": {
        "best_for": {"skill": "초중급자~상급자", "weight": "50–100kg", "style": "Parawing · Hybrid", "spot": ["강릉", "양양", "한강(약풍)"]},
        "skill_position": "intermediate",
        "attrs": {"skill": 4, "speed": 4, "glide": 4, "maneuver": 4, "stability": 3, "pump": 4},
        "weight_range_kg": "50–100kg",
        "wind_range": "10–25노트",
    },
    "glide": {
        "best_for": {"skill": "초중급자~상급자", "weight": "60–100kg", "style": "Choppy-Freeride · Wave", "spot": ["강릉", "양양", "제주"]},
        "skill_position": "intermediate",
        "attrs": {"skill": 4, "speed": 4, "glide": 4, "maneuver": 4, "stability": 3, "pump": 4},
        "weight_range_kg": "60–100kg",
        "wind_range": "12–28노트",
    },
    "glide-midlength": {
        "best_for": {"skill": "초중급자~상급자", "weight": "60–110kg", "style": "Hybrid · 가족", "spot": ["한강", "강릉", "양양"]},
        "skill_position": "intermediate",
        "attrs": {"skill": 3, "speed": 3, "glide": 4, "maneuver": 3, "stability": 5, "pump": 4},
        "weight_range_kg": "60–110kg",
        "wind_range": "10–25노트",
    },
    "ultra-glide": {
        "best_for": {"skill": "초중급자~상급자", "weight": "60–100kg", "style": "Hybrid · Downwind/SUP", "spot": ["한강(약풍)", "강릉(약풍)", "제주(약풍)"]},
        "skill_position": "intermediate",
        "attrs": {"skill": 4, "speed": 4, "glide": 5, "maneuver": 3, "stability": 4, "pump": 5},
        "weight_range_kg": "60–100kg",
        "wind_range": "8–22노트",
    },
    "prosurf": {
        "best_for": {"skill": "초중급자~상급자", "weight": "55–85kg", "style": "Wave · Surf foil", "spot": ["양양", "제주", "강원도"]},
        "skill_position": "advanced",
        "attrs": {"skill": 5, "speed": 4, "glide": 4, "maneuver": 5, "stability": 2, "pump": 5},
        "weight_range_kg": "55–85kg",
        "wind_range": "8–20노트(파도)",
    },

    # ── Forward WIP (safety/comfort gear) ──────────────────
    # attrs: protection / comfort / mobility / durability / fit / versatility
    "helmet": {
        "best_for": {"skill": "전 라이더", "weight": "전 체중대", "style": "전 스타일", "spot": ["강릉", "양양", "한강"]},
        "skill_position": "beginner",
        "attrs": {"protection": 5, "comfort": 4, "mobility": 4, "durability": 4, "fit": 4, "versatility": 5},
        "weight_range_kg": "전 체중대",
        "wind_range": "—",
    },
    "harness": {
        "best_for": {"skill": "초중급~선수", "weight": "전 체중대", "style": "Long session 라이더", "spot": ["강릉", "양양", "한강"]},
        "skill_position": "intermediate",
        "attrs": {"protection": 2, "comfort": 5, "mobility": 4, "durability": 4, "fit": 5, "versatility": 4},
        "weight_range_kg": "전 체중대",
        "wind_range": "—",
    },
    "impact-vest": {
        "best_for": {"skill": "전 라이더", "weight": "전 체중대", "style": "전 스타일", "spot": ["강릉", "양양", "한강"]},
        "skill_position": "beginner",
        "attrs": {"protection": 5, "comfort": 4, "mobility": 4, "durability": 4, "fit": 4, "versatility": 5},
        "weight_range_kg": "전 체중대",
        "wind_range": "—",
    },
    "boots": {
        "best_for": {"skill": "전 라이더", "weight": "전 체중대", "style": "4계절 spot 라이더", "spot": ["강릉", "양양", "한강"]},
        "skill_position": "beginner",
        "attrs": {"protection": 4, "comfort": 4, "mobility": 4, "durability": 4, "fit": 4, "versatility": 5},
        "weight_range_kg": "전 체중대",
        "wind_range": "—",
    },
}

# Attribute label maps
ATTR_LABELS_EQUIP = {
    "skill": ("숙련도 요구", "Skill required", "라이더 실력 요구도. 별 많을수록 입문에는 부담."),
    "speed": ("속도감", "Speed feel", "탑엔드 속도와 가속의 강도. 5 = race grade."),
    "glide": ("글라이드", "Glide", "lift 유지력·다운윈드 적합도. 5 = 무한 glide."),
    "maneuver": ("조작성", "Maneuverability", "jibe·tack·trick 회전 응답. 5 = 즉각."),
    "stability": ("안정성", "Stability", "정지·낙상 안전성. 5 = 입문 친화."),
    "pump": ("펌프 효율", "Pump efficiency", "1 펌핑당 글라이드 거리. 5 = SUP foil 적합."),
}
ATTR_LABELS_SAFETY = {
    "protection": ("보호력", "Protection", "충격·낙상 보호 강도. 5 = 인증급."),
    "comfort": ("착용감", "Comfort", "장시간 착용 편안함. 5 = 1시간+ OK."),
    "mobility": ("동작성", "Mobility", "라이딩 자유도. 5 = 비착용 수준."),
    "durability": ("내구성", "Durability", "1 시즌 daily 사용 견딤. 5 = 5년+."),
    "fit": ("핏 조절", "Fit range", "체형별 size 폭. 5 = 광범위."),
    "versatility": ("다목적성", "Versatility", "카테고리 cross-use. 5 = 4계절."),
}

SKILL_TIERS = ["beginner", "intermediate", "advanced", "pro"]
SKILL_TIER_LABELS = {
    "beginner": "입문자",
    "intermediate": "초중급",
    "advanced": "상급자",
    "pro": "선수레벨",
}
SKILL_TIER_COLORS = {
    "beginner": "var(--tier-beg)",
    "intermediate": "var(--tier-mid)",
    "advanced": "var(--tier-adv)",
    "pro": "var(--tier-pro)",
}

BRAND_LABELS = {
    "levitaz": "Levitaz",
    "ppc": "PPC",
    "takoon": "Takoon",
    "wip": "Forward WIP",
}

CATEGORY_GROUPS = {
    "levitaz": [
        ("Free Series Front Wing", ["fw-540", "fw-680", "fw-790", "fw-900"]),
        ("Boom FS 보드", ["boom-fs-63", "boom-fs-83", "boom-fs-95"]),
        ("Race", ["r6-race"]),
    ],
    "ppc": [
        ("M-Series Wing (4-tier)", ["m2", "m1-x", "m1", "fds"]),
    ],
    "takoon": [
        ("입문·Parawing 보드", ["cruise", "slide"]),
        ("Freeride·Hybrid 보드", ["glide", "glide-midlength"]),
        ("Specialty 보드", ["ultra-glide", "prosurf"]),
    ],
    "wip": [
        ("Safety", ["helmet", "impact-vest"]),
        ("Comfort", ["harness", "boots"]),
    ],
}


def attr_labels_for(sku):
    return ATTR_LABELS_SAFETY if sku["brand"] == "wip" else ATTR_LABELS_EQUIP


def render_stars(score, max_=5):
    full = "★" * score
    empty = "☆" * (max_ - score)
    return full + empty


def render_bar(score, max_=5, kind="equip"):
    """Color bar segments — gradient sea→sun based on score level."""
    pct = (score / max_) * 100
    return f'<div class="attr-bar" data-score="{score}"><div class="attr-bar__fill attr-bar__fill--{kind}" style="width:{pct}%"></div></div>'


def render_attr_block(sku):
    labels = attr_labels_for(sku)
    rows = []
    for key, (kr, en, desc) in labels.items():
        score = sku["_viz"]["attrs"].get(key, 0)
        kind = "safety" if sku["brand"] == "wip" else "equip"
        rows.append(f'''
        <li class="attr-row" tabindex="0">
          <div class="attr-row__head">
            <span class="attr-row__label"><span class="attr-row__kr">{kr}</span><span class="attr-row__en">{en}</span></span>
            <span class="attr-row__stars" aria-label="{score} of 5">{render_stars(score)}</span>
            <span class="attr-row__num">{score}<span>/5</span></span>
          </div>
          {render_bar(score, kind=kind)}
          <p class="attr-row__desc">{desc}</p>
        </li>''')
    return "\n".join(rows)


def render_skill_journey(sku):
    pos = sku["_viz"]["skill_position"]
    pos_idx = SKILL_TIERS.index(pos)
    items = []
    for i, tier in enumerate(SKILL_TIERS):
        active = " journey-step--active" if i == pos_idx else ""
        passed = " journey-step--passed" if i < pos_idx else ""
        items.append(f'''
        <li class="journey-step{active}{passed}" data-tier="{tier}">
          <span class="journey-step__dot"></span>
          <span class="journey-step__label">{SKILL_TIER_LABELS[tier]}</span>
        </li>''')
    return f'''
    <ol class="journey">
      {"".join(items)}
    </ol>'''


def render_best_for_card(sku):
    bf = sku["_viz"]["best_for"]
    pos = sku["_viz"]["skill_position"]
    spots = " · ".join(bf["spot"])
    return f'''
    <aside class="best-for">
      <div class="best-for__top">
        <span class="best-for__brand">{BRAND_LABELS[sku["brand"]]}</span>
        <span class="best-for__model">{sku["model"]}</span>
      </div>
      <div class="best-for__rating" data-tier="{pos}">
        <span class="best-for__rating-num">{SKILL_TIER_LABELS[pos]}</span>
        <span class="best-for__rating-label">권장 라이더 등급</span>
      </div>
      <dl class="best-for__stats">
        <dt>추천 스킬</dt><dd>{bf["skill"]}</dd>
        <dt>체중 범위</dt><dd>{bf["weight"]}</dd>
        <dt>풍속 범위</dt><dd>{sku["_viz"]["wind_range"]}</dd>
        <dt>스타일</dt><dd>{bf["style"]}</dd>
        <dt>한국 spot</dt><dd>{spots}</dd>
      </dl>
    </aside>'''


def render_spec_table(sku):
    """공통 (재질·구조·용도·보증) 정보 + 사이즈별 풀 row 표.
    - "size별 N~M" 요약 형식 금지 (DO_NOT_REVERT §96).
    - 가격은 verified 값 또는 "협의 중" — "추정" 표기 금지 (§92, §96).
    """
    common_rows = []
    SIZE_KEYS = {"사이즈", "Size", "Volume", "Length", "Width", "Wing area", "Span", "Aspect ratio", "체중대", "가격"}
    for k, v in sku["spec"].items():
        if k in SIZE_KEYS:
            continue  # 사이즈별 표로 분리
        common_rows.append(f'<tr><th scope="row">{k}</th><td>{v}</td></tr>')

    common_table = ""
    if common_rows:
        common_table = f'''
    <div class="spec-table-wrap">
      <table class="spec-table">
        <caption class="spec-table__caption">공통 사양</caption>
        <tbody>
          {"".join(common_rows)}
        </tbody>
      </table>
    </div>'''

    # ── 사이즈별 풀 row 표 ──────────────────────────────────
    sized_html = render_sized_spec_table(sku)
    return common_table + sized_html


def _krw_for_takoon_size(sku_id, size, eur_price):
    """Phase 11 정책: 사이즈별 KRW = "협의 중" (B2B FOB 기준 정확 값 본사 자료 cross-check 필요).
    EUR RRP 만 reference 표기."""
    if eur_price and float(eur_price) > 0:
        return f"€{eur_price} · ₩ 협의 중"
    return "협의 중"


def render_sized_spec_table(sku):
    sid = sku["id"]
    # Takoon boards: factory data
    if sid in TAKOON_HANDLE_MAP:
        handle = TAKOON_HANDLE_MAP[sid]
        prod = TAKOON_BY_HANDLE.get(handle)
        if not prod:
            return ""
        size_detail = TAKOON_SIZE_DETAIL.get(sid, {})
        # de-duplicate variants by size (some have color variants)
        seen = set()
        variants = []
        for v in prod["v"]:
            sz = v["s"]
            if sz in seen:
                continue
            seen.add(sz)
            variants.append(v)
        rows = []
        for v in variants:
            sz = v["s"]
            detail = size_detail.get(sz, {})
            volume = detail.get("volume", "확인 중")
            weight_target = detail.get("weight_target", "확인 중")
            weight_g = v.get("g", 0)
            board_weight = f"{weight_g/1000:.1f} kg" if weight_g else "확인 중"
            price_kr = _krw_for_takoon_size(sid, sz, v.get("p"))
            rows.append(
                f'<tr>'
                f'<th scope="row">{sz}"</th>'
                f'<td>{volume}</td>'
                f'<td>{board_weight}</td>'
                f'<td>{weight_target}</td>'
                f'<td>{price_kr}</td>'
                f'</tr>'
            )
        return f'''
    <div class="spec-table-wrap">
      <table class="spec-table spec-table--sized">
        <caption class="spec-table__caption">사이즈별 사양</caption>
        <thead>
          <tr>
            <th scope="col">Size</th>
            <th scope="col">Volume</th>
            <th scope="col">보드 무게</th>
            <th scope="col">권장 체중</th>
            <th scope="col">한국 가격</th>
          </tr>
        </thead>
        <tbody>
          {"".join(rows)}
        </tbody>
      </table>
      <p class="spec-table__note">* 사이즈별 정확 견적은 카톡 1:1 상담으로 확인하세요. EU RRP는 본사 reference 가격 (한국 retail은 운송·관부가세·마진 포함 별도 산출).</p>
    </div>'''

    # Other SKUs: SIZED_SPEC fallback
    if sid in SIZED_SPEC:
        config = SIZED_SPEC[sid]
        rows = []
        # decide column shape based on first row keys
        sample = config["rows"][0]
        has_volume = "volume" in sample
        for r in config["rows"]:
            cells = [f'<th scope="row">{r["size"]}</th>']
            if has_volume:
                cells.append(f'<td>{r.get("volume", "확인 중")}</td>')
            cells.append(f'<td>{r.get("weight_target", "—")}</td>')
            cells.append(f'<td>{r.get("wind", "—")}</td>')
            cells.append(f'<td>협의 중</td>')
            rows.append('<tr>' + ''.join(cells) + '</tr>')
        cols = [f'<th scope="col">{config["size_label"]}</th>']
        if has_volume:
            cols.append('<th scope="col">Volume</th>')
        cols.append('<th scope="col">권장 체중</th>')
        cols.append('<th scope="col">권장 풍속</th>')
        cols.append('<th scope="col">한국 가격</th>')
        return f'''
    <div class="spec-table-wrap">
      <table class="spec-table spec-table--sized">
        <caption class="spec-table__caption">사이즈별 사양</caption>
        <thead>
          <tr>{"".join(cols)}</tr>
        </thead>
        <tbody>
          {"".join(rows)}
        </tbody>
      </table>
      <p class="spec-table__note">* 사이즈별 정확 견적은 카톡 1:1 상담으로 확인하세요.</p>
    </div>'''
    return ""


def render_features(sku):
    items = []
    for title, body in sku["features"]:
        items.append(f'''
        <li class="feature-item">
          <h4 class="feature-item__title">{title}</h4>
          <p class="feature-item__body">{body}</p>
        </li>''')
    return f'<ul class="feature-list">{"".join(items)}</ul>'


def find_sku(sku_id):
    for s in DATA["skus"]:
        if s["id"] == sku_id:
            return s
    return None


def render_cross_sell(sku):
    items = []
    for cid in sku["cross_sell"]:
        c = find_sku(cid)
        if not c:
            continue
        viz = VIZ.get(cid, {})
        skill = viz.get("best_for", {}).get("skill", "")
        items.append(f'''
        <a href="../{c["brand"]}/{c["id"]}.html" class="xsell-card">
          <div class="xsell-card__visual">
            <img src="{c["hero_image"]}" alt="{c["model"]}" loading="lazy" decoding="async" onerror="this.parentElement.classList.add('xsell-card__visual--ph')" />
          </div>
          <div class="xsell-card__body">
            <span class="xsell-card__brand">{BRAND_LABELS[c["brand"]]}</span>
            <h4 class="xsell-card__name">{c["model"]}</h4>
            <p class="xsell-card__tag">{c["tagline"]}</p>
            <span class="xsell-card__skill">→ {skill}</span>
          </div>
        </a>''')
    return f'<div class="xsell-grid">{"".join(items)}</div>'


def render_category_compare(sku):
    """Render the category comparison table for the sku's category group."""
    brand = sku["brand"]
    groups = CATEGORY_GROUPS.get(brand, [])
    # find the group containing this sku
    target_group = None
    for name, ids in groups:
        if sku["id"] in ids:
            target_group = (name, ids)
            break
    if not target_group or len(target_group[1]) < 2:
        return ""
    name, ids = target_group
    sku_list = [find_sku(i) for i in ids if find_sku(i)]
    cols = ["price_short", "weight_range", "wind_range", "skill_short", "highlight"]
    headers_kr = ["가격", "체중 범위", "풍속 범위", "스킬", "한 줄 특성"]

    def short_price(s):
        p = s["spec"].get("가격", "—")
        return p.split(" ")[0] if p else "—"

    def short_skill(s):
        viz = VIZ.get(s["id"], {})
        return viz.get("best_for", {}).get("skill", "—")

    def highlight(s):
        return s["tagline"][:32] + ("…" if len(s["tagline"]) > 32 else "")

    rows = []
    for s in sku_list:
        viz = VIZ.get(s["id"], {})
        cells = [
            short_price(s),
            viz.get("weight_range_kg", "—"),
            viz.get("wind_range", "—"),
            short_skill(s),
            highlight(s),
        ]
        is_current = " compare-row--current" if s["id"] == sku["id"] else ""
        link = f'<a href="{s["id"]}.html" class="compare-row__link">{s["model"]}</a>' if s["id"] != sku["id"] else f'<span class="compare-row__link">{s["model"]}</span>'
        cell_html = "".join(f'<td>{c}</td>' for c in cells)
        rows.append(f'<tr class="compare-row{is_current}"><th scope="row">{link}</th>{cell_html}</tr>')

    head_html = "".join(f'<th>{h}</th>' for h in headers_kr)
    return f'''
    <div class="compare-section">
      <h2 class="compare-section__title">카테고리 비교 — {name}</h2>
      <p class="compare-section__sub">같은 카테고리 라인업 가로 비교. 현재 모델 <span class="compare-current-pin">●</span></p>
      <div class="compare-wrap">
        <table class="compare-table">
          <thead><tr><th>모델</th>{head_html}</tr></thead>
          <tbody>{"".join(rows)}</tbody>
        </table>
      </div>
    </div>'''


def render_telemetry(sku):
    """Race-car dashboard style summary — telemetry-flavored data presentation."""
    viz = sku["_viz"]
    attrs = viz["attrs"]
    # equipment vs safety
    if sku["brand"] == "wip":
        primary = ("보호력", attrs["protection"], "Protection")
        secondary = ("착용감", attrs["comfort"], "Comfort")
        tertiary = ("동작성", attrs["mobility"], "Mobility")
    else:
        primary = ("속도", attrs["speed"], "Speed")
        secondary = ("글라이드", attrs["glide"], "Glide")
        tertiary = ("조작성", attrs["maneuver"], "Maneuver")

    def gauge(label, score, en):
        pct = (score / 5) * 100
        return f'''
        <div class="gauge">
          <div class="gauge__ring" style="--p:{pct}">
            <span class="gauge__num">{score}<small>/5</small></span>
          </div>
          <span class="gauge__label">{label}<em>{en}</em></span>
        </div>'''

    return f'''
    <div class="telemetry">
      <div class="telemetry__head">
        <span class="telemetry__pip"></span>
        <span class="telemetry__title">PERFORMANCE TELEMETRY</span>
        <span class="telemetry__chip">DMJ-CALIBRATED</span>
      </div>
      <div class="telemetry__gauges">
        {gauge(*primary)}
        {gauge(*secondary)}
        {gauge(*tertiary)}
      </div>
    </div>'''


# ─────────────────────────────────────────────────────────────────────────
# HEAD / NAV / FOOTER (shared) — extracted from existing brand pages
# ─────────────────────────────────────────────────────────────────────────

def head_html(sku):
    title = f'{sku["model"]} — {BRAND_LABELS[sku["brand"]]} 상세 | 단무지공방'
    desc = f'{sku["model"]} 제품 상세. {sku["tagline"]}. 제원·성능 시각화·카테고리 비교. 단무지공방 한국 정식 수입.'
    return f'''<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>{title}</title>
<meta name="description" content="{desc}" />
<meta property="og:title" content="{title}" />
<meta property="og:description" content="{sku["tagline"]}" />
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
<link rel="stylesheet" href="../../assets/css/style.css" />
<link rel="stylesheet" href="../product-detail.css" />
</head>
<body>
'''


def nav_html():
    # Detail 페이지 nav = 메인 (takoon.html / index.html) nav 와 동일 마크업.
    # paths만 ../../로 prefix (detail 페이지는 site/products/{brand}/ 위치).
    # DO_NOT_REVERT §97: 모든 페이지 nav = 단일 template. 회귀 시 nav 망가짐.
    return '''
<a class="skip-link" href="#main">본문 바로가기</a>

<div class="trust-bar"><div class="container"><div class="trust-bar__inner">
<span class="trust-bar__item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>정식 수입·정품 보증</span>
<span class="trust-bar__item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>당일 출고</span>
<span class="trust-bar__item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>1년 AS 보증</span>
<span class="trust-bar__item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>카톡 상담</span>
</div></div></div>

<header class="site-header" id="site-header">
  <div class="container">
    <nav class="nav" aria-label="주 메뉴">
      <a href="../../index.html" class="nav__logo" aria-label="단무지공방 홈">
        <span class="nav__logo-mark">D</span>
        <span>DMJ<span style="color:var(--color-sea)">·</span>공방</span>
        <span class="nav__logo-sub">단무지공방</span>
      </a>

      <div class="nav__primary" role="menubar">
        <!-- 1. 브랜드 -->
        <div class="nav__has-sub" role="none">
          <a href="../../index.html#brands" class="nav__link" role="menuitem" aria-haspopup="true">브랜드</a>
          <div class="nav__sub" role="menu">
            <a href="../../levitaz.html" class="nav__sub-link" role="menuitem"><b>Levitaz</b><span>올림픽공인 하이드로포일/보드</span></a>
            <a href="../../ppc.html" class="nav__sub-link" role="menuitem"><b>PPC</b><span>하이퍼포먼스 윙</span></a>
            <a href="../../takoon.html" class="nav__sub-link" role="menuitem"><b>Takoon</b><span>부담없는 시작</span></a>
            <a href="../../wip.html" class="nav__sub-link" role="menuitem"><b>Forward WIP</b><span>탑라이더들의 안전장비</span></a>
          </div>
        </div>

        <!-- 2. 라이딩 스타일 -->
        <div class="nav__has-sub" role="none">
          <a href="../../index.html#styles" class="nav__link" role="menuitem" aria-haspopup="true">라이딩 스타일</a>
          <div class="nav__sub" role="menu">
            <a href="../../style/flat-speed.html" class="nav__sub-link" role="menuitem"><b>Flat·Speed</b><span>평수면·속도</span></a>
            <a href="../../style/choppy-freeride.html" class="nav__sub-link" role="menuitem"><b>Choppy·Freeride</b><span>한국 일반 스팟</span></a>
            <a href="../../style/wave.html" class="nav__sub-link" role="menuitem"><b>Wave</b><span>파도·서핑</span></a>
            <a href="../../style/hybrid.html" class="nav__sub-link" role="menuitem"><b>Hybrid</b><span>다목적</span></a>
          </div>
        </div>

        <!-- 3. 종목 -->
        <div class="nav__has-sub" role="none">
          <a href="../../index.html#genre" class="nav__link">종목</a>
          <div class="nav__sub" role="menu">
            <a href="../../genre/sup.html" class="nav__sub-link" role="menuitem"><b>SUP</b><span>다운윈드·SUP 포일</span></a>
            <a href="../../genre/wing.html" class="nav__sub-link" role="menuitem"><b>윙</b><span>Wingfoil</span></a>
            <a href="../../genre/kite.html" class="nav__sub-link" role="menuitem"><b>카이트</b><span>Kite·Formula Kite</span></a>
            <a href="../../genre/parawing.html" class="nav__sub-link" role="menuitem"><b>패러윙</b><span>Parawing</span></a>
            <a href="../../genre/pump.html" class="nav__sub-link" role="menuitem"><b>펌핑포일</b><span>Pumpfoil</span></a>
            <a href="../../genre/surf.html" class="nav__sub-link" role="menuitem"><b>서핑</b><span>Surffoil</span></a>
          </div>
        </div>

        <!-- 4. 장비 -->
        <div class="nav__has-sub" role="none">
          <a href="../../catalog.html" class="nav__link">장비</a>
          <div class="nav__sub" role="menu">
            <a href="../../catalog.html#wing" class="nav__sub-link" role="menuitem"><b>윙</b><span>네 브랜드 윙 전체</span></a>
            <a href="../../catalog.html#foil" class="nav__sub-link" role="menuitem"><b>포일</b><span>프론트·스테빌·마스트·퓨즐</span></a>
            <a href="../../catalog.html#board" class="nav__sub-link" role="menuitem"><b>보드</b><span>입문~프로 보드</span></a>
            <a href="../../catalog.html#accessory" class="nav__sub-link" role="menuitem"><b>악세서리</b><span>웻수트·하니스·헬멧·임팩트자켓</span></a>
          </div>
        </div>

        <!-- 5. 실력 수준 -->
        <div class="nav__has-sub" role="none">
          <a href="../../index.html#consultation" class="nav__link" role="menuitem" aria-haspopup="true">실력 수준</a>
          <div class="nav__sub nav__sub--wide" role="menu">
            <a href="../../level/beginner.html" class="nav__sub-link" role="menuitem"><b>입문자</b><span>첫 시즌·첫 셋업</span></a>
            <a href="../../level/intermediate.html" class="nav__sub-link" role="menuitem"><b>초·중급</b><span>Jibe·tack 정복</span></a>
            <a href="../../level/advanced.html" class="nav__sub-link" role="menuitem"><b>상급자</b><span>전문 분야 진입</span></a>
            <a href="../../level/pro.html" class="nav__sub-link" role="menuitem"><b>선수레벨</b><span>Race·대회</span></a>
            <a href="../../women/index.html" class="nav__sub-link" role="menuitem"><b>여성 라이더</b><span>Women fit·progression</span></a>
            <a href="../../junior/index.html" class="nav__sub-link" role="menuitem"><b>유소년·어린이</b><span>안전·작은 사이즈</span></a>
            <a href="../../family/index.html" class="nav__sub-link" role="menuitem"><b>가족 라이딩</b><span>3-4 set 번들</span></a>
          </div>
        </div>

        <!-- 6. 스마트 컨설팅 (CTA) -->
        <a href="../../find-my-gear.html" class="nav__link nav__link--cta" role="menuitem" style="background:var(--color-sun);color:var(--color-navy);padding:8px 16px;border-radius:999px;font-weight:600">스마트 컨설팅 ↗</a>
      </div>

      <div class="nav__actions">
        <button class="nav__icon-btn" aria-label="검색 (Phase 2 예정)" disabled title="Phase 2 예정">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/></svg>
        </button>
        <a href="https://pf.kakao.com/" target="_blank" rel="noopener" class="nav__icon-btn" aria-label="카톡 상담">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </a>
        <button class="nav__hamburger" data-menu-open aria-label="메뉴 열기" aria-controls="mobile-menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
        </button>
      </div>
    </nav>
  </div>
</header>
'''


def footer_html():
    return '''
<footer class="site-footer">
  <div class="container">
    <div class="footer-bottom">
      <p class="footer-copyright">© 2026 단무지공방 (DMJ·공방) · Levitaz · PPC · Takoon · Forward WIP 한국 정식 수입</p>
      <p class="footer-disclaimer">본 상세 페이지의 가격·제원은 본사 자료 기준 — 실제 견적은 카톡 1:1 상담으로 확인하세요.</p>
    </div>
  </div>
</footer>
</body>
</html>
'''


# ─────────────────────────────────────────────────────────────────────────
# Main page assembly
# ─────────────────────────────────────────────────────────────────────────

def render_detail_page(sku):
    sku["_viz"] = VIZ[sku["id"]]
    bf = sku["_viz"]["best_for"]

    main = f'''
<main id="main" class="product-detail">
  <!-- Hero -->
  <section class="pd-hero">
    <div class="container pd-hero__grid">
      <div class="pd-hero__visual">
        <div class="pd-hero__image-wrap" data-brand="{sku["brand"]}">
          <img src="{sku["hero_image"]}" alt="{sku["model"]} 제품 사진"
               class="pd-hero__image"
               loading="eager"
               decoding="async"
               onerror="this.classList.add('pd-hero__image--err')" />
          <span class="pd-hero__brand-mark" data-brand="{sku["brand"]}">{BRAND_LABELS[sku["brand"]]}</span>
        </div>
        <ol class="pd-hero__crumbs">
          <li><a href="../../index.html">단무지공방</a></li>
          <li><a href="../../{sku["brand"]}.html">{BRAND_LABELS[sku["brand"]]}</a></li>
          <li>{sku["model"]}</li>
        </ol>
      </div>
      <div class="pd-hero__copy">
        <span class="pd-hero__category">{sku["category_kr"]}</span>
        <h1 class="pd-hero__title">{sku["model"]}</h1>
        <p class="pd-hero__tagline">{sku["tagline"]}</p>
        {render_telemetry(sku)}
        {render_best_for_card(sku)}
        <div class="pd-hero__cta">
          <a href="https://pf.kakao.com/_DMJ" class="btn btn--accent btn--lg" target="_blank" rel="noopener">카톡 1:1 상담</a>
          <a href="../../find-my-gear.html" class="btn btn--ghost btn--lg">1분 진단 →</a>
        </div>
      </div>
    </div>
  </section>

  <!-- Skill journey -->
  <section class="section section--tight">
    <div class="container">
      <h2 class="section-head section-head--center">라이딩 여정에서 이 모델의 위치</h2>
      <p class="section-sub section-sub--center">현재 모델은 어느 단계의 라이더에게 적합한지, 다음 step은 무엇인지 표시합니다.</p>
      {render_skill_journey(sku)}
    </div>
  </section>

  <!-- Performance attribute bars -->
  <section class="section section--mist">
    <div class="container">
      <h2 class="section-head section-head--center">Performance Attributes</h2>
      <ul class="attr-list">
        {render_attr_block(sku)}
      </ul>
    </div>
  </section>

  <!-- Spec table -->
  <section class="section">
    <div class="container">
      <h2 class="section-head section-head--center">제원 (Specifications)</h2>
      <p class="section-sub section-sub--center">본사 공식 스펙 + 한국 가격. 정확한 견적은 카톡 1:1 상담으로 확인하세요.</p>
      {render_spec_table(sku)}
    </div>
  </section>

  <!-- Features -->
  <section class="section section--mist">
    <div class="container">
      <h2 class="section-head section-head--center">핵심 특징</h2>
      <p class="section-sub section-sub--center">단무지 퍼포먼스 어드바이저가 직접 라이딩·검증한 5가지 포인트</p>
      {render_features(sku)}
    </div>
  </section>

  <!-- Voice -->
  <section class="section section--tight">
    <div class="container">
      <blockquote class="rider-voice">
        <p class="rider-voice__quote">"{sku["rider_voice"]}"</p>
        <footer class="rider-voice__src">— 단무지공방 큐레이션 노트</footer>
      </blockquote>
    </div>
  </section>

  <!-- Category compare -->
  <section class="section">
    <div class="container">
      {render_category_compare(sku)}
    </div>
  </section>

  <!-- Cross-sell -->
  <section class="section section--mist">
    <div class="container">
      <h2 class="section-head section-head--center">함께 보면 좋은 모델</h2>
      <p class="section-sub section-sub--center">같은 카테고리 다른 옵션 + 보완 장비. 이 모델 외 다른 답안도 비교하세요.</p>
      {render_cross_sell(sku)}
    </div>
  </section>

  <!-- CTA -->
  <section class="section">
    <div class="container">
      <div class="pd-cta">
        <h2 class="pd-cta__title">결정이 어려우면 — 단무지에 물어보세요</h2>
        <p class="pd-cta__body">옥덕필 코치가 라이딩 스타일·체중·spot·풍속 패턴 분석해서 best fit 추천합니다. 평균 응답 시간 8분.</p>
        <div class="pd-cta__actions">
          <a href="https://pf.kakao.com/_DMJ" class="btn btn--accent btn--lg" target="_blank" rel="noopener">카톡 1:1 상담 — 8분 응답</a>
          <a href="../../find-my-gear.html" class="btn btn--secondary btn--lg">1분 진단 시작 →</a>
        </div>
      </div>
    </div>
  </section>
</main>
'''
    return head_html(sku) + nav_html() + main + footer_html()


# ─────────────────────────────────────────────────────────────────────────
# Brand-hub comparison fragment (HTML-injectable)
# ─────────────────────────────────────────────────────────────────────────

def render_brand_compare(brand):
    groups = CATEGORY_GROUPS.get(brand, [])
    sections = []
    for name, ids in groups:
        sku_list = [find_sku(i) for i in ids if find_sku(i)]
        if not sku_list:
            continue
        rows = []
        for s in sku_list:
            viz = VIZ.get(s["id"], {})
            attrs = viz["attrs"]
            avg = sum(attrs.values()) / len(attrs)
            primary = attrs.get("speed", attrs.get("protection", 0))
            secondary = attrs.get("glide", attrs.get("comfort", 0))
            tertiary = attrs.get("stability", attrs.get("durability", 0))
            price = s["spec"].get("가격", "—").split(" ")[0]
            skill = viz.get("best_for", {}).get("skill", "—")
            wt = viz.get("weight_range_kg", "—")
            wind = viz.get("wind_range", "—")
            rows.append(f'''
            <tr>
              <th scope="row"><a href="products/{s["brand"]}/{s["id"]}.html" class="compare-row__link">{s["model"]}</a></th>
              <td>{price}</td>
              <td>{skill}</td>
              <td>{wt}</td>
              <td>{wind}</td>
              <td><span class="mini-stars" aria-label="{primary} of 5">{render_stars(primary)}</span></td>
              <td><span class="mini-stars">{render_stars(secondary)}</span></td>
              <td><span class="mini-stars">{render_stars(tertiary)}</span></td>
            </tr>''')
        if brand == "wip":
            attr_h = ["보호력", "착용감", "내구성"]
        else:
            attr_h = ["속도", "글라이드", "안정성"]
        sections.append(f'''
        <div class="compare-section reveal">
          <h3 class="compare-section__title">{name}</h3>
          <div class="compare-wrap">
            <table class="compare-table compare-table--brand">
              <thead>
                <tr>
                  <th>모델</th>
                  <th>가격</th>
                  <th>스킬</th>
                  <th>체중</th>
                  <th>풍속</th>
                  <th>{attr_h[0]}</th>
                  <th>{attr_h[1]}</th>
                  <th>{attr_h[2]}</th>
                </tr>
              </thead>
              <tbody>
                {"".join(rows)}
              </tbody>
            </table>
          </div>
        </div>''')
    return f'''
<!-- Phase 11 — Brand Comparison Table -->
<section class="section section--mist" id="compare-{brand}">
  <div class="container">
    <h2 class="section-head section-head--center">{BRAND_LABELS[brand]} 라인업 가로 비교</h2>
    <p class="section-sub section-sub--center">선수관리사이트 스타일 — 가격·스킬·체중·풍속·핵심 attribute 한눈에 비교. 모델명 클릭 시 detail page로 이동합니다.</p>
    {"".join(sections)}
    <p class="compare-disclaimer reveal">* 가격은 RRP × 환율 + 운송·관부가세·마진 반영 한국 retail. 정확한 견적은 카톡 1:1 상담으로 확인하세요. * 별점은 단무지공방 자체 캘리브레이션 기준 (5 = best in class).</p>
  </div>
</section>
'''


# ─────────────────────────────────────────────────────────────────────────
# Run
# ─────────────────────────────────────────────────────────────────────────

def main():
    out_dir = ROOT / "products"
    out_dir.mkdir(exist_ok=True)
    counts = {"levitaz": 0, "ppc": 0, "takoon": 0, "wip": 0}
    for sku in DATA["skus"]:
        if sku["id"] not in VIZ:
            print(f"SKIP (no viz): {sku['id']}")
            continue
        html = render_detail_page(sku)
        target_dir = out_dir / sku["brand"]
        target_dir.mkdir(exist_ok=True)
        target = target_dir / f'{sku["id"]}.html'
        target.write_text(html, encoding="utf-8")
        counts[sku["brand"]] += 1
        print(f"  {sku['brand']}/{sku['id']}.html — {len(html):,} bytes")

    # Write brand comparison fragments
    frag_dir = out_dir / "_fragments"
    frag_dir.mkdir(exist_ok=True)
    for brand in ["levitaz", "ppc", "takoon", "wip"]:
        frag = render_brand_compare(brand)
        (frag_dir / f"compare-{brand}.html").write_text(frag, encoding="utf-8")
        print(f"  fragment compare-{brand}.html — {len(frag):,} bytes")

    print(f"\nDONE — generated {sum(counts.values())} detail pages")
    for b, c in counts.items():
        print(f"  {b}: {c}")


if __name__ == "__main__":
    main()
