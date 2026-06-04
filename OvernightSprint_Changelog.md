# 야간 스프린트 — 작업 결과 (2026-05-05)

Danny가 자는 동안 수행한 dmjgroup.kr 완성형 작업 리포트.
6 phase 모두 완료. 매 phase 끝에 file commit (timeout 방지).

---

## TL;DR — 5 줄 요약

1. **Layout whitespace 해결** — Hero·brand hub 모두 split layout (text 좌 + visual 우). 4-brand orbit constellation SVG 추가.
2. **Nav 정리** — 윈드서핑 카테고리 제거, 윙포일/포일 분리 → **Wing/Foil/SUP/Accessory** 4개로 통일.
3. **Levitaz 큐레이션** — Free Series Front Wing 4종 + **Boom FS 보드 3종 (95/83/63)** + **R6 Race Series** 신규 추가.
4. **PPC 큐레이션 좁히기** — 기존 Wing/Foil/Board → **Sonic FDS · M1 · M2 세 wing만** (보드/포일은 inquiry).
5. **Takoon 재구성** — **Wing V4 / V4 Pro 2026 / VX Pro V2** + **Glide 보드 6 사이즈 / Comet 4 사이즈**. 윈드서핑 sail 제외.

---

## Phase별 변경 사항

### Phase 1 — 사이트 Audit (완료)
- 산출: `Phase1_AuditIssues.md`
- 모든 layout/nav/product 이슈 위치별로 정리. 각 이슈에 해결 방안 명시.

### Phase 2 — 레이아웃 fix (완료)
**index.html 광범위 변경**
- Hero: 단일 컬럼 → split (text 60% + visual 40%). 우측에 SVG-based **4-brand orbit constellation** (DMJ center + L/P/T/W marks orbiting). CSS animation으로 회전.
- "4 Brands · One Curation" 섹션-head: 좌측 카피 + 우측 4-stat 사이드 panel.
- Brand cards: 각 카드 `__decor` SVG 추가 (Levitaz: foil silhouette, PPC: wing triangle, Takoon: paddle curve, WIP: helmet outline).
- Hero quick-tags: Wing Foil / Pump · Surf · Downwind / SUP / Wetsuit · Helmet
- Description Philosophy: pill 단조로움 해결 → **value-card** (large numeral 01/02/03 + gradient text).
- Differentiation 섹션: inline-styled 박스 → `value-card` 컴포넌트로 통일.

**CSS 추가 항목** (`assets/css/style.css` 끝에 v1.1 섹션)
- `.hero__inner--split` / `.hero__visual` / `.hero__visual-orbit` (회전 ring)
- `.hero__visual-marks` / `.hero__visual-mark--levitaz/ppc/takoon/wip`
- `.brand-hero__layout` / `.brand-hero__visual` / `.brand-hero__monogram-xl`
- `.section-head--split` / `.section-head__side` / `.section-head__stat`
- `.stats-strip` / `.value-card` / `.value-card__num`
- `.sku-card__visual--enhanced` / `.sku-illustration` / `.sku-card__corner-tag`
- `.brand-band` / `.philo-num` / `.cta-strip` / `.compare-table`
- `.hero__quick-tags` / `.sport-grid--four`
- 모바일 보강 미디어쿼리

### Phase 3 — Navigation 정리 (완료)
**모든 페이지 일관 적용**
- 윈드서핑 카테고리 nav에서 삭제 (desktop + mobile + footer)
- 윙포일 → "Wing", 포일 → "Foil" 영문화 (sport-tile은 한글 유지)
- 새 nav 4개: **Wing / Foil / SUP / Accessory + Brand ▾**
- Brand 드롭다운 sub-text 갱신:
  - Levitaz: "오스트리아 프리미엄 포일"
  - PPC: "All-around Performance Wing" (← Mid-Premium에서 변경)
  - Takoon: "Wing · SUP · Pump" (← Entry 윙·세일에서 변경)
  - WIP: "프랑스 보호장비"
- Sport tile (homepage): 5개 → 4개 (윈드서핑 제외, 액세서리는 Wetsuit · Helmet · Impact로 sub-label 정리)
- Footer Sport list: 4개로 통일

**적용 파일:** index.html, levitaz.html, ppc.html, takoon.html, wip.html, 404.html, catalog.html, policy/privacy.html, policy/refund.html, policy/shipping.html, policy/terms.html

### Phase 4a — Levitaz 큐레이션 확장 (완료)

**섹션 1: Free Series Front Wing** (기존 유지·polish)
- FW 540 (강풍) · FW 680 ★ (한국 표준) · FW 790 (글라이드) · FW 900 (약풍·다운윈드)
- 모든 카드에 enhanced SVG illustration (foil cross-section · 비율에 맞는 크기)
- Corner-tag 추가 (Strong Wind / ★ 한국 표준 / Glide / Light Wind)

**섹션 2: Boom Boards (신규 추가)**
- **Boom FS 95** — Beginner~Light Wind, 가장 친절한 take-off
- **Boom FS 83 ★** — All-round sweet spot (한국 표준 추천)
- **Boom FS 63** — Skilled · Strong Wind sporty
- 각 보드 SVG illustration (윗·아랫면 분리·rocker 표현)
- 가격: [Phase 2 확정] 표기 (본사 Boom FS RRP 미공개)

**섹션 3: R6 Race Series (신규 추가)**
- Olympic 2024 출시, race specialist 라인
- 4 핵심 feature 명시: stainless-steel box · titanium mast · integrated trim · flexing wing structure
- 단무지의 입장: "Free Series로 시작 → race grade 도달 시 next step"
- 별도 dark-themed sku-card

**Brand Hero 갱신**
- Split layout 적용 (좌측 LEVITAZ name + tagline + lead + meta / 우측 monogram XL + foil silhouette + orbit ring)
- 'CORE Titanium · Made in Austria' 배지

**Brand Story 추가 단락**
- R6 Race 라인 도입 단락 추가 (Free Series → R6 step-up 설명)

### Phase 4b — PPC 큐레이션 좁히기 (완료)

**lineup 전면 교체**
- 기존: Wing 5.0 · Foil Set · Board 5'2"
- 신규: **Sonic FDS** (Premium · Full Dual Skin) / **M1** (Performance · thermo-bonded seam) / **M2** ★ (All-around · dacron + Kevlar)
- 보드/포일은 inquiry로 응대 (페이지에 명시)
- 5년 본사 보증 강조 (trust-bar에도 반영)

**Compare Table** 추가
- FDS · M1 · M2 비교 (Tier · Skin · 대상 라이더 · 한국 표준 추천 · 호환 · 보증)

**Performance Signature**
- M2 wing (versatile)으로 변경 — 처음 한 wing 권장 캐릭터에 맞는 5축

**Brand Hero**
- Split layout, Performance Wing tagline, 5Y Warranty 배지

### Phase 4c — Takoon 재구성 (완료)

**Wings 섹션** (V4 / V4 Pro 2026 / VX Pro V2)
- **Wing V4** — Standard, ultra-light, 입문~중급 표준
- **Wing V4 Pro 2026** ★ — **65 g/m² quadruple ripstop** (이전 V3 Pro 54 g/m² 대비 진화). Spec 강조.
- **Wing VX Pro V2** — Performance · Freefly 강화

**Boards 섹션** (Glide / Comet)
- **Glide Board** ★ — 6 사이즈 (4'9 60L ~ 5'8 110L), Wing/SUP foil 통합
- **Comet Board** — 4 사이즈 (5'0/5'4/5'10/6'0), Wing/Surf
- **Pump Foil** cross-link — inquiry 응대 (옵션)

**Compare Table**
- V4 / V4 Pro / VX Pro V2 비교

**Performance Signature**
- V4 Pro (4 Skill · 6 Speed · 7 Glide · 8 Maneuver · 9 Stability) — 입문~중급 친절 캐릭터

**Brand Story 갱신**
- 65 g/m² quadruple ripstop 진화 강조
- "싸구려 ≠ 합리적" 핵심 quote 유지

**제외**: Takoon Windsurf sail (Danny 결정)

### Phase 5 — Polish + responsive (완료)
- 모든 brand 페이지 hero를 split layout 통일 (levitaz/ppc/takoon/wip)
- WIP 페이지의 윈드서핑 텍스트 "윙·포일·SUP·서핑·카이트"로 정정 (cross-discipline 의미 유지하되 카테고리 노출 제거)
- 모든 footer Sport list 4-item으로 통일
- HTML 구문 검증 (`html.parser`로 모든 페이지 OK)
- 윈드서핑 0 occurrence (전체 site)
- Mobile responsive 확인 (Hero visual은 1024px 이상에서만 노출, 모바일에서 자연스럽게 hidden)
- Accessibility: ARIA labels, semantic markup, keyboard support 유지

### Phase 6 — Changelog + 보고 (지금)
- 본 문서: `OvernightSprint_Changelog.md`
- 함께 갱신된 audit 문서: `Phase1_AuditIssues.md`

---

## 산출 파일 list

### 수정된 파일
| 파일 | 변경 |
|-----|------|
| `site/index.html` | 전면 재작성 (split hero + 4-brand orbit + value-cards) |
| `site/levitaz.html` | 전면 재작성 (Free Series + Boom FS + R6 Race 추가) |
| `site/ppc.html` | 전면 재작성 (FDS/M1/M2 큐레이션 좁히기) |
| `site/takoon.html` | 전면 재작성 (V4/V4 Pro 2026/VX Pro V2 + Glide/Comet) |
| `site/wip.html` | nav 정정 + hero split layout |
| `site/404.html` | nav 정정 |
| `site/catalog.html` | text 정정 (윈드서핑 제거) |
| `site/policy/privacy.html` | nav 정정 |
| `site/policy/refund.html` | nav 정정 |
| `site/policy/shipping.html` | nav 정정 |
| `site/policy/terms.html` | nav 정정 |
| `site/assets/css/style.css` | v1.1 섹션 추가 (~350줄, split layouts·visuals·components) |

### 신규 파일
| 파일 | 내용 |
|-----|------|
| `site/Phase1_AuditIssues.md` | Audit 결과 + verified vs 추정 데이터 분류 |
| `site/OvernightSprint_Changelog.md` | 본 문서 |

### 변경 없음
- `site/robots.txt`
- `site/sitemap.xml` (URL 구조 동일)
- `site/policies.html` (다음 phase 정리 대상)
- `site/assets/js/main.js` (그대로 호환)

---

## Local preview 방법

```bash
cd "~/Documents/Claude/Projects/단무지 홈페이지 만들기/site"
python3 -m http.server 8080
# 브라우저에서: http://localhost:8080/
```

---

## Danny 아침 검토 시 우선 확인 항목

### 1순위 — content correctness
- [ ] **Levitaz Boom FS 보드 3종** — FS 95/83/63 사이즈 분류가 본사 가이드와 일치하는지 (Foiling Magazine 인용 기반, 정확한 부피·사이즈는 Phase 2 RRP 문서 수령 시 재검증 필요)
- [ ] **R6 Race Series 위치** — 본사가 R6를 별도 specialty 라인으로 두는 것 맞는지. 단무지가 한국 시장에 R6를 정식 도입하는지 (현재는 "옵션 별도 협의" 표기로 안전하게 처리)
- [ ] **PPC FDS** — Sonic FDS 정확 명칭 확인 (현재 "Sonic FDS" / "PPC Sonic FDS" 양쪽 사용. M1/M2와 sibling 라인으로 표기)
- [ ] **Takoon V4 Pro 2026** — 65 g/m² quadruple ripstop 스펙 정확. takoon.com 공식 confirm
- [ ] **Takoon Glide 6 사이즈 / Comet 4 사이즈** — 본사 영문 사이트 검색 결과 기반. Phase 2에 본사 RRP 문서 수령 시 사이즈/볼륨 재검증

### 2순위 — visual quality
- [ ] **Hero 4-brand orbit 시각** — 모니터에서 회전 자연스럽게 보이는지, 모바일 (768px 이하)에서 적절히 hidden되는지
- [ ] **Brand hero split layout** — 4 brand 페이지 모두 좌·우 균형 OK인지 (특히 Takoon: navy/yellow 그라데이션 배경에서 monogram 가독성)
- [ ] **Brand-card decor SVG** — homepage brand card에 추가된 작은 SVG decoration이 너무 노이즈 같지는 않은지

### 3순위 — copy review
- [ ] **단무지 입장 문구** — 페이지마다 단무지 시각이 한국 spot 추천과 일치하는지
- [ ] **가격 표기** — Levitaz Front Wing은 "RRP × 환율 추정" 명시, 그 외는 "[Phase 2 확정]" — Danny가 본사 정식 RRP 수령 후 Update
- [ ] **연락처** — `hello@dmjgroup.kr` / `https://pf.kakao.com/` (placeholder) 모두 실제 채널 연결 시 교체
- [ ] **사업자정보** — `[Phase 2 확정]` (사업자등록번호 / 통신판매업신고 / 주소 / 보호책임자) 4 항목

---

## Phase 2 (Cafe24) 전환 시 reuse plan

### 그대로 reuse 가능
- `assets/css/style.css` (전체 디자인 시스템) — Cafe24 skin에 임포트 또는 fork
- 모든 SVG illustration (homepage 4-brand orbit + brand-hero visuals + sku-illustrations)
- `assets/js/main.js` (header scroll · mobile menu · reveal · perf chart · launch form) — Cafe24 SPA 이행 시에도 standalone 모듈로

### Adapt 필요
- HTML structure → Cafe24 template 변환 (header/footer는 cafe24 standard module로 swap)
- Product cards (sku-card) → cafe24 product list block
- 가격 표기 [Phase 2 확정] → 실제 SKU price binding
- Launch form → cafe24 mailing list integration 또는 Mailchimp/Stibee

### 신규 작업 필요
- 사업자정보 4 항목 입력
- KakaoTalk 채널 정식 ID 연결
- OG 이미지 (`assets/images/og-default.jpg`) 실제 이미지 제작
- 본사 product 사진 수집 (현재는 SVG illustration placeholder) — Phase 2 polish

---

## 한국어 최종 리포트 (Danny 아침에 보는 단순 버전)

### 5 phase 진행 결과
- ✅ Phase 1: Audit (`Phase1_AuditIssues.md`)
- ✅ Phase 2: Layout — Hero/brand hub split 적용, 우측 visual 추가
- ✅ Phase 3: Nav — 윈드서핑 제거, 4 카테고리 (Wing/Foil/SUP/Accessory) 통일
- ✅ Phase 4: Product 큐레이션 — Levitaz +R6 +Boom FS, PPC narrowed to FDS/M1/M2, Takoon V4/V4 Pro/VX Pro V2 + Glide/Comet
- ✅ Phase 5: Polish + 모바일 검증 + accessibility
- ✅ Phase 6: 본 changelog

### 변경 사항 카운트
- HTML 페이지 12 개 수정
- CSS ~350줄 신규 추가
- 신규 product 6 (Boom FS 95/83/63 + R6 Race + V4 Pro 2026 + Glide 6-size variant)
- 제거 product 1 (Takoon Windsurf sail)
- nav 카테고리 5 → 4 (윈드서핑 제거, 윙포일/포일 통합 검토)

### Local preview 명령어
```bash
cd "~/Documents/Claude/Projects/단무지 홈페이지 만들기/site" && python3 -m http.server 8080
```
브라우저: http://localhost:8080/

### 우선 확인할 항목 (Danny 아침)
1. **Levitaz R6 Race + Boom FS 분류** 본사 confirm
2. **PPC Sonic FDS 명칭** 정확성
3. **Takoon V4 Pro 65 g/m²** spec confirm + 사이즈별 부피
4. **Hero 4-brand orbit visual** 데스크톱·모바일 모두 자연스러운지
5. **가격 표기 일관성** ([Phase 2 확정] vs RRP 추정 모두 본사 정식 RRP 도착 시 일괄 갱신)

---

## 작업 메모

- **Cowork egress 차단**: levitaz.com, ppcfoiling.com, takoon.com 모두 차단됨 → WebSearch로 정보 수집 (Foiling Magazine, geislinger.com, 공식 사이트 description 인용)
- **공식 사진 fetch 불가** → Enhanced SVG illustration으로 대체 (Phase 2에 Danny 본사 자료 수령 시 swap)
- **academic_writing 원칙 준수** — verified source는 본문 인용, 추정값은 [Phase 2 확정] 또는 [추정] 명시. 가격은 모두 본사 정식 RRP 도착 시 갱신.

작업 끝. 잘 자고 일어나서 review 부탁해 🙏

---
[리브랜딩 2026-05-05: 단무지그룹 → 단무지 — Option A 채택. 이 changelog 안 '단무지'은 후속 일괄 치환 결과이며, 작성 당시 brand는 '단무지그룹'이었음.]
