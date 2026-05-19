# Consultation Frame v1 — 변경 로그

작성일: 2026-05-05  
세션: Mega Task — Phase A~H 동시 build (Danny 외출 중)  
운영자 권고: 옥덕필 수석코치 운영 단무지공방의 1:1 컨설팅 frame을 site에 정식 도입.

---

## 1. 핵심 변화 (v0 → v1)

| 항목 | v0 (이전) | v1 (현재) |
|---|---|---|
| Site 정체성 | "4 brand 정식 수입 큐레이션" | **"당신의 라이딩을 컨설팅합니다"** — 옥덕필 코치 직접 컨설팅 frame |
| Primary nav | Wing/Foil/SUP/Acc + Brand | **컨설팅 (4 levels) · Find My Gear · 라이딩 스타일 (4) · Brand · About** |
| 라이더 진입 path | brand 단위 → product | **레벨/스타일 단위 → 큐레이션 매트릭스 → product** |
| Product 큐레이션 | brand별 SKU list | **64-시나리오 매트릭스** (4 레벨 × 4 체중 × 4 스타일) |
| 상담 CTA | "카톡 채널 상담" | **"Find My Gear 1분 퀴즈"** + 카톡 컨설팅 |
| PPC 라인업 ordering | M1·M1-X·M2·FDS (혼재) | **M2 → M1-X → M1 → FDS** (입문→중급→상급자→선수 순서로 통일) |
| Takoon 보드 | Glide·Comet 2 모델 | **6 보드 × 4 카테고리** (패러윙·윙포일·다운윈드·펌핑/서핑) + Cruise 입문 highlight |

---

## 2. 새 페이지 9개 (v0 대비 신규)

### 레벨별 컨설팅 (4)
- `/level/beginner.html` — 입문자: 첫 시즌·첫 셋업 (~18 KB)
- `/level/intermediate.html` — 초·중급: jibe·tack 정복 (~18 KB)
- `/level/advanced.html` — 상급자: specialty 진입 (~18 KB)
- `/level/pro.html` — 선수레벨: race·대회 (~18 KB)

각 페이지 구성: Hero → 5개 Problem 카드 → Why 4-points → **16-card 매트릭스** (4 체중 × 4 스타일) → Next-step path → 5-Q FAQ → 1:1 컨설팅 CTA

### 스타일별 컨설팅 (4)
- `/style/flat-speed.html` — Flat·Speed (평수면·속도)
- `/style/choppy-freeride.html` — Choppy·Freeride (한국 일반 spot)
- `/style/wave.html` — Wave (파도·서핑)
- `/style/hybrid.html` — Hybrid (다목적)

각 페이지 구성: Hero → 4-character points + 한국 spot 매핑 → **16-card 매트릭스** (4 레벨 × 4 체중) → 1:1 컨설팅 CTA

### Quiz Funnel (1)
- `/find-my-gear.html` — 4-step 퀴즈 (Level → Weight → Style → Sport) → JS 매트릭스 lookup → 추천 결과 카드 → 카톡 컨설팅 CTA

---

## 3. 데이터 + 렌더러 (신규)

### `/data/products.json`
- 4-brand 제품 카탈로그 (wings · foils · boards · accessories)
- **PPC 라인업 ordering**: `["ppc-m2", "ppc-m1x", "ppc-m1", "ppc-fds"]` (메타데이터 명시)
- **Takoon 6 보드 추가**: `takoon-cruise · takoon-slide · takoon-glide-midlength · takoon-glide · takoon-ultra-glide · takoon-prosurf`
- **Levitaz Boom 3 보드**: FS 63 · FS 83 · FS 95 (premium race-oriented)
- **WIP 6 액세서리**: Helmet · Impact Vest · Harness · Wetsuit 3/2 · Wetsuit 4/3 · Boots
- **가격 methodology**: EU RRP 직접 환산 금지 명시. 운송 + 한-EU FTA 관세 (0%) + KR VAT (10%) + markup 공식 명문화.

### `/data/equipment_matrix.json`
- **64 entries** (4 levels × 4 weights × 4 styles)
- 각 entry: wing primary/alternative + sizes_m2 / foil + mast / board / 3-4 accessories / Korean reasoning copy / tags / Danny review flag
- **v1.2 (오늘) 변경사항**: Takoon 6 보드 적용, 입문자 = Cruise (cross-category), 상급자+ wave = Prosurf, 상급자+ choppy/hybrid = Levitaz Boom 83L premium, 선수 = Boom 63/83
- 0 missing product references (Python 검증 완료)

### `/assets/js/matrix.js` (신규)
- 단일 shared renderer (no frameworks)
- API: `DMJMatrix.renderLevel(level, target)` · `DMJMatrix.renderStyle(style, target)` · `DMJMatrix.renderQuiz(level, weight, style, target)` · `DMJMatrix.lookup(...)`
- 매트릭스 카드 동적 렌더 — 16 cards per level page · 16 cards per style page · 1 card for quiz result
- products.json 자동 lookup (페이지 깊이 자동 감지 — `level/*`, `style/*`, root 모두 동작)

### `/assets/css/style.css` (618 lines 추가)
- `.cons-hero` (8 variants — level별 4 + style별 4 gradient)
- `.cons-problem` · `.cons-why` · `.cons-matrix` · `.cons-next` · `.cons-faq` · `.cons-cta`
- `.mtx-card` · `.mtx-weight-group` · `.mtx-row` · `.mtx-tag` · `.mtx-prod`
- `.quiz-frame` · `.quiz-step` · `.quiz-option` · `.quiz-progress` · `.quiz-result`
- 모바일 반응형 (auto-fit grid, breakpoint 800px)

---

## 4. 기존 페이지 수정사항

### `index.html`
- **Hero 카피 전면 재작성**: "당신의 라이딩을 컨설팅합니다" — 옥덕필 코치 credentials prominent
- **Primary nav 재구성**: 컨설팅 (4 levels 드롭다운) · Find My Gear (CTA) · 라이딩 스타일 (4 styles 드롭다운) · Brand · About
- **모바일 메뉴**: 9개 entry로 확장 — Find My Gear top + 4 levels + 4 styles
- **Consultation Hub 섹션** 신규 추가 (sports 섹션 위) — Find My Gear 큰 CTA + 4 level cards + 4 style cards
- PPC brand card sub: "All-around Performance Wing" → **"M2 · M1-X · M1 · Sonic FDS"** (4-tier 정확 표기)
- 메타: 4 Brand 큐레이션 메시지 유지 + Consultation Frame v1 추가

### `ppc.html` — PPC 라인업 ordering 정정 ★
- Title/meta/og 모두 **M2 → M1-X → M1 → FDS** 순서로 변경
- Hero tagline: `M1·M1-X·M2·FDS` → `M2·M1-X·M1·FDS`
- Lineup 섹션 헤더: "입문·중급·고급·레이싱" → **"입문·초중급·상급자·선수"**
- Lead text: "M2 친동생 → M1 야생마 → M1-X 나비 → FDS" → **"M2 친동생 → M1-X 나비 → M1 야생마 → FDS"**
- **카드 물리적 swap**: position 2 = M1-X (초·중급), position 3 = M1 (상급자) ← 이전과 swap
- Tier badge: M1-X = 초·중급, M1 = 상급자 (Advanced)
- Compare table 컬럼: M2 / M1-X / M1 / FDS (header + cells 재배치)
- CTA heading: "M2, M1, M1-X, FDS —" → "M2 → M1-X → M1 → FDS —"

### `takoon.html` — 6 보드 × 4 카테고리 ★
- Title/meta: "Wing V4 / V4 Pro / VX Pro V2 + Glide·Comet" → **"Wing 3-tier · Board 6 모델 4 카테고리"**
- Hero lead: 보드 6 모델 (Cruise·Slide·Glide·Glide ML·Ultra Glide·Prosurf) 4 카테고리 명시
- Boards 섹션 전면 재구성:
  - **Cruise highlight 카드** (sun/yellow gradient) — 입문자 cross-category 정답
  - **4 카테고리 그리드**:
    - 패러윙 (purple) → Slide
    - 윙포일/프리라이드 (sea blue) → Glide
    - 하이브리드 Wing/DW/SUP (green) → Glide Midlength
    - 다운윈드/SUP (deep blue) → Ultra Glide
    - 펌핑/서핑 (red) → Prosurf
  - **Level × Category 매트릭스 표** — 입문/중급/고급별 size 매핑
- 가격 표시 변경: 전 모델에 "EU RRP ₩XXX–XXX + 운송·관부가세 별도" 명시 + "한국 retail 환산 후 [Phase 2]" 안내

### `sitemap.xml`
- 16 URL → **20 URL** 확장 (level 4 + style 4 + find-my-gear + catalog 추가)
- 새 페이지 priority 0.85~0.95

---

## 5. 64 시나리오 매트릭스 — Status

| 차원 | 값 | Verified | Danny review pending |
|---|---|---|---|
| Level | beginner / intermediate / advanced / pro | 4 | 0 |
| Weight | light / mid-light / mid-heavy / heavy | 4 | 0 |
| Style | flat-speed / choppy-freeride / wave / hybrid | 4 | 0 |
| **Total entries** | 64 | 64 | — |
| **Wing 매핑** | PPC ordering 적용 | 64 | 0 |
| **Foil 매핑** | Levitaz Free Series 4 FW × 3 mast | 64 | 0 |
| **Board 매핑** | Takoon 6 + Levitaz Boom 3 | 64 | **6 entries** (heavy pro `[Danny review]` 플래그) |
| **Accessory 매핑** | WIP 6 모델 | 64 | 0 |

**Danny review 권고 entry** (matrix tags에 `[Danny review]` 명시):
- pro × light × all styles
- pro × mid-light × all styles  
- pro × mid-heavy × all styles
- pro × heavy × all styles (heavy + pro 조합 — 본사 custom 권장)

---

## 6. 이미지 수집 status — Phase A 보류

이미지 collection은 본 세션 timing 제약으로 **placeholder path만 등록**:
- `assets/images/levitaz/{모델}_main.jpg` (10 path)
- `assets/images/ppc/{모델}_main.jpg` (4 path)
- `assets/images/takoon/{모델}_main.jpg` (7 path)
- `assets/images/wip/{모델}_main.jpg` (6 path)

각 product의 `image` 필드는 products.json에 등록되어 있으나 **실제 파일은 없음**. 사이트 렌더 시 broken image — Danny가 본사 자료 또는 본사 사이트 screenshot으로 채워야 함.

**대안**: matrix card 렌더에서는 image를 사용하지 않음 (text-based card). 따라서 입문자 → 큐레이션 결과 → 큐레이션 카톡 컨설팅 path는 image 없어도 동작.

**우선순위 (Danny에게)**:
1. 핵심 4 brand hub 페이지 (levitaz · ppc · takoon · wip)에 사용할 hero image (1장씩)
2. PPC 4-tier hero image (M2 · M1-X · M1 · FDS)
3. Takoon 6 보드 product shot (Cruise · Slide · Glide · Glide ML · Ultra Glide · Prosurf)
4. Levitaz Free Series 다이어그램 (4 FW + 3 mast + STAB 180)

---

## 7. Local preview

```bash
cd "/Users/dannyok/Documents/Claude/Projects/단무지공방 홈페이지 만들기/site"
python3 -m http.server 8080
# 브라우저: http://localhost:8080
```

테스트 path:
1. `http://localhost:8080/` — 새 hero + Consultation hub 확인
2. `http://localhost:8080/find-my-gear.html` — 4-step 퀴즈 → 결과 확인
3. `http://localhost:8080/level/intermediate.html` — 16 카드 매트릭스 렌더 확인
4. `http://localhost:8080/style/wave.html` — 16 카드 매트릭스 렌더 확인
5. `http://localhost:8080/ppc.html` — 카드 ordering M2 → M1-X → M1 → FDS 확인
6. `http://localhost:8080/takoon.html` — 6 보드 × 4 카테고리 + Cruise highlight 확인

---

## 8. Danny 검토 우선 항목 (Top 5)

### 우선순위 1: 가격 — Takoon EU RRP 환산 ★
- products.json에 등록된 Takoon EU RRP는 **운송·관부가세 미포함**
- `_meta.pricing_methodology`에 공식 명시
- Danny의 가격표.xlsx에서 정확한 한국 retail 가격 확정 필요
- site는 현재 "[Phase 2 확정]" 표시만 있어 가격 노출은 없음 — 안전

### 우선순위 2: PPC 라인업 ordering 검증 (전체 site)
- ppc.html · index.html 정정 완료
- catalog.html, levitaz.html, wip.html, takoon.html 등 cross-reference 점검 필요
- bash grep으로 잔존 `M1.*M2`, `M1-X.*M1` 같은 잘못된 ordering이 없는지 확인:
  ```bash
  grep -rn "M1.*M2\|M2.*M1[^-]" site/*.html
  ```

### 우선순위 3: Takoon 6 보드 spec 정확성
- Cruise/Slide/Glide ML/Ultra Glide/Prosurf 사이즈·volume 범위는 Danny 스크린샷 기반
- Cruise는 5 사이즈로 가정 (5'4·5'10·6'2·6'10·7'2) — 실제 본사 카탈로그 cross-check
- Slide·Glide ML는 4 사이즈 가정 — 실제는 다를 수 있음

### 우선순위 4: heavy + pro 조합 6 entries
- 매트릭스에 `[Danny review]` flag 적용
- "heavy pro 라이더는 본사 custom 권장 — 1:1 컨설팅" 메시지로 처리
- 실제 라이더가 들어왔을 때 1:1 컨설팅으로 individual 추천이 정답

### 우선순위 5: 이미지 collection
- 64 카드 매트릭스는 image 없이 text로 동작 — site 기본 동작 OK
- 그러나 brand hub · level/style hero · find-my-gear 결과는 image 있으면 conversion ↑
- 본사에서 product shot · lifestyle shot 일괄 요청 권장

---

## 9. 시간 추정 (다음 세션)

- 이미지 50-100장 수집 + 등록: 4~8시간 (Danny 본인 또는 다음 컨설팅 세션)
- 가격표.xlsx에서 Takoon 한국 retail 확정 + site 적용: 1~2시간
- 한국 spot photo session (양양·강릉·제주): 1~2일 (옥덕필 코치 + 라이더)
- 본사 4 brand에 image asset 요청 메일: 30분

---

## 10. 신뢰성 disclaimers (site에 노출됨)

- 64 매트릭스 reasoning은 단무지 best-effort 큐레이션
- 본인 spot·체중·specialty 정확한 큐레이션은 카톡 1:1 컨설팅 권장 (모든 페이지 CTA에 명시)
- Danny review pending 항목은 [Danny review] tag로 site 카드에 시각적 표시 가능 (matrix renderer 지원)

---

## 11. v1 → v1.1 (다음 세션 권고)

1. Takoon 가격 정정 — products.json에 한국 retail 등록
2. 이미지 50장 wave (4-brand hero + 6 Takoon 보드 + 4 PPC wing + 4 Levitaz FW)
3. 카톡 채널 link `https://pf.kakao.com/` → 단무지 실제 채널 ID 교체
4. Footer/nav를 기존 levitaz/ppc/takoon/wip 페이지에도 새 ordering 적용 (currently new 9 페이지에만 적용)
5. About 페이지 — 옥덕필 코치 credentials 페이지 신규 작성 (3회 올림픽 출전·국가대표 수석코치 detail)
6. Find My Gear v1.1 — Body Weight slider input (현재 4-button) + Sport selection이 결과에 영향

---
[리브랜딩 2026-05-05: 단무지그룹 → 단무지공방 — Option A 채택. 이 changelog 안 '단무지공방'은 후속 일괄 치환 결과이며, 작성 당시 brand는 '단무지그룹'이었음.]
