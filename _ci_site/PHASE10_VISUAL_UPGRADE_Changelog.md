# PHASE 10 — Visual Upgrade Changelog

**날짜**: 2026-05-05
**범위**: 좌측 정렬 타이틀 audit → center 정렬, hero video embed (index), brand video story (4 brand pages), image-led layout (8 style/level pages)
**Phase 9 후속**: Danny 피드백 "텍스트 위주 → quality 판단 어려움 + 멋진 이미지·영상 부족" 반영.

---

## Step 1 — 좌측 정렬 타이틀 audit + center 정렬

### Problem
`.section-head` (no `--center` modifier) 15곳 — 모두 우측이 빈 공간이라 어색. 의도된 "left + side panel" 케이스는 `section-head--split` modifier로 별도 관리됨.

### Audit 결과
| 페이지 | orphan 좌측 정렬 → center 변경 |
|---|---|
| index.html | 2 (Performance 5축, Differentiation) |
| levitaz.html | 4 (FW lineup, Foundation, Wide Wing, R6) |
| ppc.html | 3 (M-series, Quick Compare, Recommendation) |
| takoon.html | 4 (V4 lineup, Boards, V4 Pro Performance, Compare) |
| wip.html | 2 (Categories, Cross-sell) |
| **Total** | **15곳** |

### CSS 정책 추가
```css
/* Phase 10 정책: 기본 정렬은 center. 우측에 visual(이미지/SVG/stat panel)이
   있을 때만 left 유지 (예: section-head--split). orphan 좌측 정렬 (우측이
   빈 공간) 금지. */
.section-head--with-visual { text-align: left; max-width: none; }
```

### 검증
- `class="section-head reveal"` (orphan left) grep → **0건** ✅
- 17 페이지 (index/4 brand/8 style+level/4 demographic) 일관성 확인

---

## Step 2 — Hero video embed (index.html)

### 변경
4-brand orbit SVG (140줄) → YouTube background video iframe.

```html
<div class="hero__visual hero__visual--video" aria-hidden="true">
  <iframe class="hero__video-iframe"
          src="https://www.youtube-nocookie.com/embed/YT_HERO_VIDEO_ID?autoplay=1&mute=1&loop=1&playlist=...&controls=0&modestbranding=1&playsinline=1"
          ...></iframe>
  <div class="hero__video-poster" role="img"></div>
  <div class="hero__video-overlay"></div>
  <div class="hero__video-badges">L · P · T · W</div>
  <span class="hero__video-tag">DMJ · 4 BRAND CURATION</span>
</div>
```

### 동작
- **Desktop (≥ 1024px)**: YouTube iframe autoplay loop muted
- **Mobile (< 1024px)**: iframe display:none, poster gradient/이미지만 표시 (저전력)
- **prefers-reduced-motion**: iframe 자동 hidden
- **YouTube nocookie 도메인** 사용 (privacy)
- 4 brand letter badges (L/P/T/W) + DMJ curation tag overlay

### TODO[Danny]
- `YT_HERO_VIDEO_ID` 실제 video ID로 교체
- 추천 채널: youtube.com/@levitazfoils · @takoonkites · @ppcfoiling
- Mobile poster: 현재는 navy gradient. CDN 이미지 URL 추가 권장

### CSS 추가 (style.css)
```
.hero__visual--video { aspect-ratio: 16/9; max-width: 640px; ... }
.hero__video-iframe / -poster / -overlay / -tag / -badges
@media (max-width: 1023px) { .hero__video-iframe { display: none; } }
@media (prefers-reduced-motion: reduce) { .hero__video-iframe { display: none; } }
```

---

## Step 3 — Brand Story Video 섹션 (4 brand pages)

### 신설 섹션 위치
각 brand의 기존 텍스트 "Brand Story" 섹션 **위쪽**에 신규 video block 삽입.

| 페이지 | 추가 섹션 | TODO 영상 ID |
|---|---|---|
| levitaz.html | "레비타즈를 영상으로" | `LVZ_BRAND_VIDEO_ID` |
| ppc.html | "PPC를 영상으로" | `PPC_BRAND_VIDEO_ID` |
| takoon.html | "타쿤을 영상으로" | `TAKOON_BRAND_VIDEO_ID` |
| wip.html | "Forward WIP을 영상으로" | `WIP_BRAND_VIDEO_ID` |

### 구조
- `section-head section-head--center` (eyebrow + h2 + lead)
- `brand-video-wrap` (16:9 iframe, controls=1, max-width 880px)
- `brand-video-caption` (한국 대화체 카피, max-width 720px, center on desktop, left on mobile)

### 한국 대화체 caption 톤
- Levitaz: "이 영상 보시면 Levitaz가 왜 '단가 비싼 이유'를 매번 정당화하는지 이해되실 거예요. 카본 안에 직접 압입된 **티타늄 코어**..."
- PPC: "AR 8 이상의 좁은 단면, top speed에서의 절대적 안정. **25노트 이상**에서 진가가 드러나요..."
- Takoon: "영상 속 V4 Pro의 **65 g/m² quadruple ripstop** — 단단하면서도 부담 없이 잡히는 손맛..."
- WIP: "영상 속 **harness · impact vest** — 윙포일 등 통증 한 방에 해결, 본격 라이더의 첫 액세서리 1순위..."

---

## Step 4 — Image-led layout (8 style/level 페이지)

### Hero 이미지 background
8 페이지의 `cons-hero` 모두에 `cons-hero--with-image` modifier 추가:
- Unsplash CDN URL을 `<img class="cons-hero__bg-image">`로 삽입 (lazy, onerror=opacity:0)
- CSS overlay (opacity 0.32, 위에 dark gradient)로 텍스트 가독성 유지
- 이미지 fail 시 기존 gradient만 표시 (graceful fallback)

### Style 페이지 (4)
| 페이지 | Hero 컨셉 | Splitter 3-cell labels |
|---|---|---|
| flat-speed.html | 평수면·속도 | Speed Run · Glide · Precision |
| choppy-freeride.html | 한국 일반 spot | Versatile · Korean Wind · Comfort |
| wave.html | 파도 라이딩 | Drop In · Carving · Barrel |
| hybrid.html | 다목적 | Wing · Foil · SUP/Pump |

### Level 페이지 (4)
| 페이지 | Hero 컨셉 | Splitter 3-cell labels |
|---|---|---|
| beginner.html | 첫 시즌 | First Ride · Bigger Wing · Safety First |
| intermediate.html | jibe·tack 정복 | Jibe · Tack · Upwind |
| advanced.html | specialty 진입 | Top Speed · Carving · Jumps |
| pro.html | race·대회 | Race Start · Mark Turn · Precision |

### Splitter 위치
모든 페이지에서 `cons-why` (스타일 기술 특징) 섹션 끝과 `cons-matrix` 섹션 시작 사이에 삽입.
3-image collage (4:3 aspect), hover scale 1.05, label badge bottom-left.
모바일에서 2+1 배치 (3번째 셀이 16:7 wide cell로 span 2).

### CSS 추가
```css
.cons-hero--with-image::after { /* dark gradient overlay */ }
.cons-hero__bg-image { position: absolute; opacity: 0.32; ... }
.image-strip { padding: clamp(32px,5vw,64px) 0; }
.image-strip__grid { grid-template-columns: repeat(3, 1fr); ... }
.image-strip__cell { aspect-ratio: 4/3; border-radius: 8px; ... }
@media (max-width: 640px) { /* 2+1 mobile layout */ }
```

---

## Step 5 — 검증 결과

### Pattern 일관성 grep
```
class="section-head reveal"  →  0 건 (orphan left) ✅
cons-hero--with-image        →  8 건 (모든 style/level 페이지) ✅
image-strip__grid            →  8 건 (모든 style/level 페이지) ✅
brand-video-wrap             →  4 건 (모든 brand 페이지) ✅
hero__visual--video          →  1 건 (index.html) ✅
```
총 21 신규 visual block, 15 left → center 변경.

### Viewport 검증 (CSS 차원)
| Viewport | Hero video | Brand video | Image strip | Section head |
|---|---|---|---|---|
| 1920 / 1440 | iframe play | iframe (16:9, 880px) | 3-col grid | center |
| 1024 | iframe play | iframe (16:9 fluid) | 3-col grid | center |
| 768 | poster only | iframe (16:9) | 3-col grid | center |
| 640 | poster only | iframe (16:9) | 2+1 grid | center |
| 375 | poster only | iframe (16:9) | 2+1 grid | center |

### Title 마침표 규칙 (Phase 9 메모리)
- noun-ending 마침표 → 추가된 새 카피 검사 → **0 건** ✅
- verb-ending (다·요·까) 마침표 → 보존 ✅ (예: "이해되실 거예요.", "달리는 윙이에요.")

### Footer · Nav 일관성
- 8 page (style/level) hero 변경 후에도 `<header>`, `<footer>` 구조 그대로 ✅
- `cons-hero` 안의 z-index: bg-image(1) → ::before(2) → ::after(1) → __inner(3) — 텍스트 가독성 OK

---

## Danny 검토 우선 5건

1. **YouTube 영상 ID 5개 교체 필요**
   - `YT_HERO_VIDEO_ID` (index hero)
   - `LVZ_BRAND_VIDEO_ID` / `PPC_BRAND_VIDEO_ID` / `TAKOON_BRAND_VIDEO_ID` / `WIP_BRAND_VIDEO_ID`
   - 각 brand 공식 채널에서 가장 dynamic한 액션 영상 권장. iframe url 안 `VIDEO_ID` 토큰 2회 (loop용 playlist 파라미터 포함) 모두 교체.

2. **Unsplash placeholder → licensed 액션 사진 swap**
   - 8 hero + 24 splitter cell = 32 이미지 모두 Unsplash CDN URL placeholder 사용
   - Phase 2 commerce launch 전, 라이선스 명확한 brand provided 액션 사진 교체 권장
   - 단무지가 직접 한국 spot에서 촬영한 사진이 있으면 brand authenticity 가장 높음

3. **Hero video Mobile poster image**
   - 현재 모바일에서 navy gradient만 표시 (CSS only)
   - 정지 이미지 (`hero__video-poster` background-image URL) 추가하면 mobile 인상 강화
   - 추천: 4 brand 액션 사진 1장 (CDN URL)

4. **Brand video aspect 변경 권장 검토**
   - 현재 16:9 default. brand 본사 영상이 9:16 (수직, IG-friendly) 또는 4:3인 경우 별도 modifier 필요
   - Levitaz/PPC는 보통 16:9 유지 OK, Takoon/WIP는 모바일 우선 영상이 있을 가능성

5. **Section-head--center 적용 — section--dark 페이지 검토**
   - signature section (index.html line 578)은 `section--dark` 배경에 centered title 처음 적용
   - dark 배경에서 centered eyebrow + title이 읽히는지 시각 검토 권장 (text-on-dark 색상은 자동 적용됨)

---

## 파일 변경 요약

| 파일 | 변경 내용 |
|---|---|
| `site/index.html` | hero SVG → video iframe + 2 section-head center |
| `site/levitaz.html` | brand video block 추가 + 4 section-head center |
| `site/ppc.html` | brand video block 추가 + 3 section-head center |
| `site/takoon.html` | brand video block 추가 + 4 section-head center |
| `site/wip.html` | brand video block 추가 + 2 section-head center |
| `site/style/flat-speed.html` | hero image overlay + 3-image splitter |
| `site/style/choppy-freeride.html` | hero image overlay + 3-image splitter |
| `site/style/wave.html` | hero image overlay + 3-image splitter |
| `site/style/hybrid.html` | hero image overlay + 3-image splitter |
| `site/level/beginner.html` | hero image overlay + 3-image splitter |
| `site/level/intermediate.html` | hero image overlay + 3-image splitter |
| `site/level/advanced.html` | hero image overlay + 3-image splitter |
| `site/level/pro.html` | hero image overlay + 3-image splitter |
| `site/assets/css/style.css` | `.section-head--with-visual`, `.hero__visual--video`, `.hero__video-*`, `.brand-video-wrap/-iframe/-caption`, `.cons-hero--with-image`, `.cons-hero__bg-image`, `.image-strip*` |

---

## Local preview

```bash
cd "단무지공방 홈페이지 만들기/site"
python3 -m http.server 8000
# 브라우저: http://localhost:8000
```

데스크톱에서 시작하여 반응형 dev tools로 viewport 5단계 (1920/1440/1024/640/375) 확인 권장.

---
[리브랜딩 2026-05-05: 단무지그룹 → 단무지공방 — Option A 채택. 이 changelog 안 '단무지공방'은 후속 일괄 치환 결과이며, 작성 당시 brand는 '단무지그룹'이었음.]
