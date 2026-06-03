# Phase 1 — 사이트 Audit (2026-05-05 야간 스프린트)

Danny가 자는 동안 dmjgroup.kr 완성형으로 만드는 작업의 Phase 1.
기존 site (`/site/`) 전체를 audit한 뒤 발견된 issue를 위치별로 정리.

---

## 1. Layout / Whitespace Issues

### 1-1. `index.html` Hero 섹션 (147~183행)
- **현상:** `.hero__inner`가 단일 컬럼. 좌측에 eyebrow→title→lead→CTA→meta까지 모두 stack. 우측 절반은 grid-pattern background만 있고 비어 있음.
- **인지 데스크톱 폭:** 1280px container 안에서 텍스트 max-width 18ch (≈400px) → 우측 880px 빈 공간.
- **해결:** Hero를 2-column split (text 60% + visual 40%). 우측에 brand-aligned SVG illustration (sea + foil silhouette) 또는 isometric 4-brand mark.

### 1-2. `index.html` "4 Brands · One Curation" 섹션 (237~300행)
- **현상:** `.section-head`가 좌측 정렬, max-width 720px → 그 외 우측이 비어 있음. brand-grid 위 빈 영역.
- **해결:** Section-head를 split — 좌측 text + 우측 mini-stat (4 brands · 5 disciplines · 양양/강릉/제주).

### 1-3. Brand Hub Hero (`levitaz.html`, `ppc.html`, `takoon.html`, `wip.html`)
- **현상:** `.brand-hero__inner`가 max-width 920px 단일 컬럼. 우측 빈 공간.
- **해결:** Split layout — 좌측 brand name + tagline + meta + CTA / 우측 brand mark (대형 monogram 또는 brand-related illustration).

### 1-4. Stat / Hero meta 분포
- **현상:** `.hero__meta` 3-column이지만 dt/dd 형식이 약함. 시각 hierarchy 부족.
- **해결:** 4-column grid (4 brand · 5 sport · 양양/강릉/제주 · 1년 AS) + icon 추가.

### 1-5. Description Philosophy 섹션 (407~443행)
- **현상:** centered prose 스타일은 이미 적절. 다만 grid-3 카드 위 "1단/2단/3단" pill이 너무 단조로움 — visual interest 부족.
- **해결:** 각 카드에 large numeral (01/02/03) + accent line.

---

## 2. Navigation Issues

### 2-1. 윈드서핑 카테고리 — 삭제 필요
- **위치:** `index.html` line 90 (desktop nav), 128 (mobile menu), 222 (sport tile), 584 (footer). 모든 brand page 동일.
- **결정:** 단무지공방은 윙포일·SUP 포커스, 윈드서핑 카테고리 노출 X. Takoon의 windsurf sail은 별도 inquiry 시 응대 (catalog 외 옵션).

### 2-2. 윈드포일 — Foil 카테고리에 통합
- **현상:** 현재 nav에 "윙포일"과 "포일"이 별도 존재. "윈드포일"은 nav에 없음 (애초에 X).
- **해결:** Nav 4개 카테고리로 정리 — **Wing / Foil / SUP / Accessory**. 윈드포일 (있으면) → Foil 카테고리 안에서 분류.

### 2-3. 새 Nav 구조 (전 페이지 일관)
```
[Logo]  Wing | Foil | SUP | Accessory | Brand ▾ [Levitaz/PPC/Takoon/WIP]   [Search] [카톡]
```

### 2-4. Sitemap.xml / robots.txt
- 대부분 변동 없음 (URL 구조 그대로). 다만 새 catalog SKU 페이지가 추가되면 sitemap 재생성 필요 — Phase 2 일.

---

## 3. Product Curation Issues

### 3-1. Levitaz (`levitaz.html`) — 부족
- **현재:** Front Wing 4종 (FW 540, 680, 790, 900)만 있음.
- **추가 필요:**
  1. **Boom FS Boom Boards** 3종 — FS 95 (early lift), FS 83 (all-round), FS 63 (skilled/windy)
  2. **R6 Race Series** Front Wing — race specialist (Olympic 2024 데뷔 라인)
- **현재 가격은 "RRP × 1.6 환율 추정" 표기. Phase 2 정식 pricing은 그대로 유지.**

### 3-2. PPC (`ppc.html`) — 큐레이션 좁히기
- **현재:** Wing 5.0, Foil Set, Board 5'2" 3종 (모두 unspecific).
- **변경:** Danny 결정 — **FDS (Sonic FDS) + M1 + M2** 3 wing만 노출. 보드/포일은 inquiry로 응대 (단무지 전문가 추천).
- **새 카드 3장:**
  1. **PPC Sonic FDS** — Full Dual Skin, 최상급, advanced rider
  2. **PPC M1 Wing** — High performance, precision, advanced
  3. **PPC M2 Wing** — Versatile (premium dacron), all-round

### 3-3. Takoon (`takoon.html`) — 라인 재구성
- **현재:** Beginner Wing 4.0, Wing 5.0, Windsurf 5.5 — 일부 imprecise.
- **변경:** takoon.com 공식 라인 기반으로 Wing/SUP만 큐레이션:
  1. **Wing V4 Pro (2026)** — 65 g/m² quadruple ripstop, 성능/내구성 강화
  2. **Wing V4** — 표준, 입문~중급 ultra-light
  3. **Wing VX Pro V2** — freefly 강화
  4. **Glide Board** — 6 사이즈 (4'9 60L ~ 5'8 110L), Wing/SUP 겸용
  5. **Comet Board** — 4 사이즈 (5'0, 5'4, 5'10, 6'0), Wing/Surf
- **윈드서핑 sail 제외** — Danny 결정.

### 3-4. WIP — 변동 없음
- 현재 placeholder 수준 유지. Phase 2에 wetsuit/helmet 라인 정식 등록.

---

## 4. Visual / Design Issues

### 4-1. 이미지 부재
- 모든 product card가 SVG dashed-border placeholder. "완성형 글로벌 brand"와 거리 멀음.
- **해결:** brand-aligned gradient + monogram + product silhouette SVG로 placeholder 품질 향상. Phase 2에 실제 사진 교체 가능하도록 클래스 유지.
- **공식 이미지 fetch 실패** (cowork-egress-blocked) → 향상된 SVG illustration으로 대체.

### 4-2. 한국 templates 스타일 잡종 우려
- 현 design은 이미 글로벌 톤이 잘 잡혀 있음. 추가 polish:
  - Hero 우측 visual element
  - Section divider의 다양화 (current divider는 단순 1px line)
  - Brand-card hover에서 monogram 확대 + tag 색상 전환

---

## 5. Microcopy / Content

### 5-1. Hero 카피
- "바람을 디자인하다 / 4 brand, 한 라이더" — 유지 (강력함)
- 우측 visual에 sub-tagline placeholder

### 5-2. Sport tile
- 현재 5개 → 4개 (윈드서핑 제외)
- "윙포일 / 포일 / SUP / 액세서리"

### 5-3. Footer
- Sport list에서 윈드서핑 제거
- 사업자정보는 "[Phase 2 확정]" 유지 (Danny 가 confidential 정보 제공 시점에 교체)

---

## 6. Verified vs. 추정 데이터

> academic_writing 원칙 — verified source만, 추정값은 `[추정]` 명시.

### 6-1. Verified (공식 사이트/매체)
- **Levitaz Boom FS** 3 사이즈 (FS 95/83/63) — Foiling Magazine, levitaz.com 검색 결과
- **Levitaz R6 Race Series** — 2024 Paris Olympic 출시, stainless-steel box, titanium mast, integrated trim — geislinger.com, levitaz.com
- **PPC M1, M2, Sonic FDS** — ppcfoiling.com, M1 (thermo-bonded seam), M2 (dacron, carbon handle/boom)
- **Takoon Wing V4 Pro 2026** — 65 g/m² quadruple ripstop — takoon.com news
- **Takoon Glide** — 6 사이즈 4'9~5'8 — takoon.com
- **Takoon Comet** — 5'0/5'4/5'10/6'0 — takoon.com

### 6-2. 추정 (Phase 2에 본사 RRP 수령 후 확정)
- Front Wing/Boom 가격 — 모두 `[Phase 2 확정]` 또는 `[추정]` 표기
- 풍속 범위 — 본사 가이드 + 한국 spot 경험 기반 (검증된 spot 가이드 인용 가능 시 출처 명시)

---

## 7. 작업 우선순위

1. **Phase 2 (Layout):** Hero split + brand hub split + sport-tile 4개 — index.html 광범위 변경
2. **Phase 3 (Nav):** 윈드서핑 제거, 모든 페이지 일관 — `find/replace` 가능한 작업
3. **Phase 4a (Levitaz):** R6 Race Series 추가, Boom FS 3종 추가 — levitaz.html 신규 섹션 2개
4. **Phase 4b (PPC):** FDS/M1/M2 3 wing으로 큐레이션 좁히기 — ppc.html sku-grid 교체
5. **Phase 4c (Takoon):** V4/V4 Pro/VX Pro V2 + Glide/Comet — takoon.html 전면 재구성
6. **Phase 5 (Polish):** Microcopy, footer, mobile re-test, accessibility
7. **Phase 6 (Changelog):** 변경 사항 요약 + Danny 검토 항목

---

## 8. Cowork egress 차단 영향

`levitaz.com`, `ppcfoiling.com`, `takoon.com` 모두 cowork allowlist 차단 (`cowork-egress-blocked`).
→ WebSearch로 정보 수집 (검색 엔진 캐시·매체 기사·공식 사이트 description 인용)
→ 이미지는 직접 fetch 불가 → enhanced SVG illustration으로 대체 (공식 사진은 Phase 2에 Danny가 본사 자료 수령 후 교체)

이 audit를 기반으로 Phase 2~6 진행.

---
[리브랜딩 2026-05-05: 단무지그룹 → 단무지공방 — Option A 채택. 이 changelog 안 '단무지공방'은 후속 일괄 치환 결과이며, 작성 당시 brand는 '단무지그룹'이었음.]
