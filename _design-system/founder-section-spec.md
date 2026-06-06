# Founder Section Spec

| 항목 | 내용 |
|---|---|
| 문서 유형 | `index.html` Sports Science Lab · Founder section spec — DOM + CSS + 활용 위치 + Alex 핸드오프 |
| Owner | Visual Designer (Rose Yoon) · 2026-06-06 |
| 의존 | `_design-system/tokens.css` + `components.md` (C1 Hero Metric + C2 Data Card 패턴 재사용) |
| Image asset | `assets/images/about/danny-hainan-candid-{16x9,4x5,1x1}.{jpg,webp}` (IMG_0504 master 변환, 보정 0건) |
| 옥대표님 결정 (placeholder) | Numeral content (Ph.D 분야 · 올림픽 출전 · 코칭 누적) — §6 자리 |

> **읽는 법.** §0 핵심 결정 · §1 DOM 구조 (3 활용 위치) · §2 CSS spec (tokens.css 참조) · §3 모바일/데스크탑 반응형 · §4 image asset variants · §5 Alex 핸드오프 정확한 위치 · §6 옥대표님 numeral 결정 큐.

---

## 0. 핵심 결정

| # | 결정 | Rationale |
|---|---|---|
| 1 | **Pattern = C1 Hero Metric + side portrait** | Design System v2 `components.md` C1 패턴 직접 재사용. "데이터 hero + 작은 사진 secondary" 정통 |
| 2 | **Layout = horizontal split (desktop) · stacked (mobile)** | Whoop/Vakaros founder portrait 정통. 모바일 = portrait 위 + metric 아래 |
| 3 | **Numeral = mono OBLIGATORY** | tokens.css `--font-mono` (JetBrains) · `.num` class 적용 |
| 4 | **Portrait crop = 4:5 vertical** (desktop side · mobile hero) + 16:9 (alt) + 1:1 (PDF Coach attribution) | 4:5 가 모바일 우호 + 라이더 face 보존 |
| 5 | **Glassmorphism caption card** (옵션) — portrait 우하단 quote / role | Whoop daily ritual card 톤 |
| 6 | **3 활용 위치** — `index.html` 신규 founder section · `about.html` consult hero · PDF cover Coach attribution | Visual reference §2-4 의 founder credibility 강화 directive |

---

## 1. DOM 구조

### 1-1. `index.html` Sports Science Lab · Founder section (★ Primary)

신규 section, philosophy / consultation hub 사이에 삽입.

```html
<section class="founder" id="founder" aria-labelledby="founder-title">
  <div class="container">
    <div class="founder__layout">

      <!-- Left — Hero metric stack (C1 패턴) -->
      <div class="founder__metrics">
        <p class="founder__eyebrow eyebrow">SailTech Sports Science Lab</p>
        <h2 class="founder__title" id="founder-title">
          <span class="founder__name num">Danny Ok</span>
          <span class="founder__role">옥덕필 · 대표</span>
        </h2>

        <dl class="founder__credentials">
          <div class="founder__credential">
            <dt class="eyebrow">학위</dt>
            <dd class="num">Ph.D</dd>
            <dd class="founder__credential-label">운동생리학 · NSCA-CSCS</dd>
          </div>
          <div class="founder__credential">
            <dt class="eyebrow">올림픽</dt>
            <dd class="num">3<span class="founder__unit">회</span></dd>
            <dd class="founder__credential-label">전 윈드서핑 국가대표 · India Techno 293 헤드코치</dd>
          </div>
          <div class="founder__credential">
            <dt class="eyebrow">코칭</dt>
            <dd class="num">100+</dd>
            <dd class="founder__credential-label">라이더 컨설팅 · 대한패들보드협회 창립자</dd>
          </div>
        </dl>

        <p class="founder__lead">
          단무지는 commerce + sports science lab. 윙포일 컨설팅의 본질은 product 아닌 데이터·코칭의 깊이.
        </p>
      </div>

      <!-- Right — Portrait (4:5 vertical) -->
      <div class="founder__portrait">
        <picture>
          <source media="(max-width: 768px)"
                  srcset="assets/images/about/danny-hainan-candid-4x5.webp" type="image/webp">
          <source srcset="assets/images/about/danny-hainan-candid-4x5.webp" type="image/webp">
          <img src="assets/images/about/danny-hainan-candid-4x5.jpg"
               alt="옥대표 · Hainan 2025 윙포일 챔피언쉽 · 라이딩 준비 중"
               loading="lazy" decoding="async">
        </picture>

        <!-- Glassmorphism caption card (옵션) -->
        <figcaption class="founder__caption">
          <span class="eyebrow">2025 China · Hainan</span>
          <span class="founder__caption-text">전국 윙포일 챔피언쉽 출전 — wetsuit + impact vest preparation</span>
        </figcaption>
      </div>

    </div>
  </div>
</section>
```

### 1-2. `about.html` consult hero (Secondary)

같은 section 의 hero variant — 16:9 horizontal portrait + 좌측 큰 numeral.

```html
<section class="founder founder--hero">
  <picture class="founder__bg">
    <source srcset="assets/images/about/danny-hainan-candid-16x9.webp" type="image/webp">
    <img src="assets/images/about/danny-hainan-candid-16x9.jpg" alt="옥대표 · 2025 China · Hainan">
  </picture>
  <div class="container">
    <h1 class="founder__name num">옥덕필</h1>
    <p class="founder__role">단무지공방 · SailTech CEO · 운동생리학 PhD</p>
    <!-- ... C1 hero metric inline + comparison ... -->
  </div>
</section>
```

### 1-3. PDF cover Coach Danny attribution (Tertiary)

Square 1:1 portrait 작은 avatar (라이딩 분석 보고서 PDF cover 옆 Coach attribution).

```html
<!-- PDF jsPDF 안 image embed -->
<img src="assets/images/about/danny-hainan-candid-1x1.jpg" width="80" height="80" class="pdf-coach-avatar">
<span class="pdf-coach-label num">Coach Danny</span>
<span class="pdf-coach-meta">Ph.D · NSCA-CSCS</span>
```

---

## 2. CSS spec (tokens.css 참조)

```css
/* ============================================================
 * .founder — Sports Science Lab · Founder section
 * Design System v2 · 의존: tokens.css
 * ============================================================ */

.founder {
  padding-block: var(--space-section);
  padding-inline: var(--gutter);
  background: var(--bg-base);
}

.founder__layout {
  display: grid;
  gap: var(--space-12);
  max-width: var(--container-base);
  margin-inline: auto;

  /* Desktop horizontal split — metrics 좌 60% / portrait 우 40% */
  grid-template-columns: 1fr;
}
@media (min-width: 960px) {
  .founder__layout {
    grid-template-columns: 1.4fr 1fr;
    align-items: center;
    gap: var(--space-16);
  }
}

/* ===== 좌 — Hero metric stack ===== */
.founder__eyebrow {
  margin: 0 0 var(--space-4);
  color: var(--accent);
}
.founder__title {
  margin: 0 0 var(--space-8);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.founder__name {
  font-family: var(--font-numeral);
  font-size: clamp(40px, 6vw, 80px);
  font-weight: var(--fw-semibold);
  line-height: 0.95;
  color: var(--fg-primary);
  letter-spacing: var(--num-letterspacing);
}
.founder__role {
  font-family: var(--font-label);
  font-size: var(--text-eyebrow);
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--fg-secondary);
}

.founder__credentials {
  display: grid;
  gap: var(--space-6);
  margin: 0 0 var(--space-8);
  padding: 0;
}
@media (min-width: 640px) {
  .founder__credentials { grid-template-columns: repeat(3, 1fr); gap: var(--space-8); }
}
.founder__credential {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
}
.founder__credential dt {
  margin: 0 0 var(--space-1);
  color: var(--fg-muted);
}
.founder__credential dd {
  margin: 0;
}
.founder__credential dd.num {
  font-family: var(--font-numeral);
  font-size: clamp(32px, 4vw, 48px);
  font-weight: var(--fw-semibold);
  color: var(--fg-primary);
  letter-spacing: var(--num-letterspacing);
  line-height: 1;
  display: flex;
  align-items: baseline;
  gap: var(--space-1);
}
.founder__unit {
  font-size: 0.5em;
  font-weight: var(--fw-medium);
  color: var(--fg-secondary);
  letter-spacing: 0;
}
.founder__credential-label {
  font-size: var(--text-body-sm);
  color: var(--fg-secondary);
  line-height: 1.5;
  margin-top: var(--space-1);
}

.founder__lead {
  font-size: var(--text-body);
  color: var(--fg-secondary);
  line-height: 1.65;
  max-width: 48ch;
  margin: 0;
}

/* ===== 우 — Portrait + caption ===== */
.founder__portrait {
  position: relative;
  border-radius: var(--radius-xl);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}
.founder__portrait img {
  display: block;
  width: 100%;
  height: auto;
  /* 4:5 aspect ratio 보장 — CSS 만, image 자체는 4:5 crop */
  aspect-ratio: 4 / 5;
  object-fit: cover;
}
.founder__caption {
  position: absolute;
  inset: auto 16px 16px 16px;
  padding: var(--space-3) var(--space-4);
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.founder__caption .eyebrow {
  color: var(--accent);
}
.founder__caption-text {
  font-size: var(--text-body-sm);
  color: var(--fg-primary);
  line-height: 1.45;
}

/* ===== Hero variant (about.html) ===== */
.founder--hero {
  position: relative;
  min-height: clamp(560px, 80vh, 800px);
  overflow: hidden;
  isolation: isolate;
}
.founder--hero .founder__bg {
  position: absolute;
  inset: 0;
  z-index: -1;
}
.founder--hero .founder__bg img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: brightness(0.55);
}
```

---

## 3. 반응형 + a11y

### 3-1. Breakpoints

| Viewport | Layout |
|---|---|
| < 640px | metrics 위 stacked · portrait 아래 4:5 · credentials 1-col |
| 640-960px | metrics 위 · portrait 아래 · credentials 3-col |
| ≥ 960px | horizontal split metrics(좌 60%) + portrait(우 40%) · credentials 3-col |

### 3-2. a11y

- `<section aria-labelledby="founder-title">` semantic landmark
- `<h2 id="founder-title">` heading anchor
- `<dl>` description list for credentials (semantic 정통)
- `<picture>` + `loading="lazy"` (above-fold 면 `eager`)
- `<img alt>` 명확 (옥대표 · Hainan 2025 · preparation)
- Glassmorphism caption — `<figcaption>` semantic, screen reader 자연 발화
- focus-visible — tokens.css `:where()` mixin 자동 적용

---

## 4. Image asset variants

| File | Crop | Use case | 권장 dimensions |
|---|---|---|---|
| `danny-hainan-candid.jpg` | 원본 비율 | archive / 옵션 hero | 원본 (master) |
| `danny-hainan-candid.webp` | 원본 | archive webp | 원본 |
| `danny-hainan-candid-16x9.{jpg,webp}` | 16:9 horizontal | about.html hero · `<picture>` fallback | 1920×1080 권장 |
| `danny-hainan-candid-4x5.{jpg,webp}` | 4:5 vertical | **★ Primary** — index.html founder section side portrait | 800×1000 또는 master 비례 |
| `danny-hainan-candid-1x1.{jpg,webp}` | 1:1 square | PDF Coach attribution avatar | 480×480 또는 master 비례 |
| `danny-hainan-candid-16x9-sm.webp` | 16:9 small | 모바일 fallback | 800×450 |

**Crop logic**:
- 4:5 — 라이더 face 보존 위해 약간 우측 치우침 (center → +width/8)
- 1:1 — 동일 logic (center → +width/12)
- 16:9 — center crop (라이더 우중앙, palm tree 좌측 보존)
- **보정 0건** — exposure / saturation / sharpening / dehaze 모두 SKIP (옥대표님 6/6 verbatim)

---

## 5. Alex 핸드오프

### 5-1. `index.html` 신규 founder section 위치

권장 삽입 위치: existing **philosophy** section 직후, **consultation hub** 직전. DOM 구조 §1-1 그대로.

CSS — `assets/css/style.css` 끝에 `.founder*` 블록 추가, 또는 (v2 전환 시) `_design-system/tokens.css` import 후 `_design-system/components.md` 안 신규 컴포넌트로 추가.

### 5-2. `about.html` hero variant

신규 page 또는 existing about page hero 교체. `.founder--hero` modifier 적용 (§2 spec).

### 5-3. PDF cover Coach attribution

`riding-dashboard/js/pdf-export.js` 안 cover 페이지에 `danny-hainan-candid-1x1.jpg` 80×80 avatar embed + "Coach Danny" + credentials.

### 5-4. Push 권장

`assets/images/about/danny-hainan-candid-*.{jpg,webp}` + `index.html` (founder section) + `style.css` (founder class) — daemon `auto_push.command` whitelist (`assets/images/about/*` + `index.html`) 또는 옥대표님 명시 push.

---

## 6. 옥대표님 numeral 결정 큐 (placeholder)

본인 본 spec 의 numeral content 는 **placeholder** — 옥대표님 직접 fact 결정 자리:

| Credential | Placeholder | 옥대표님 확정 필요 |
|---|---|---|
| 학위 | **Ph.D** · 운동생리학 · NSCA-CSCS | ✓ 정확 (Persona Bible §4 reference) |
| 올림픽 | **3회** · 전 윈드서핑 국가대표 · India Techno 293 헤드코치 | 정확한 출전 횟수 + role detail |
| 코칭 | **100+** 라이더 컨설팅 · 대한패들보드협회 창립자 | 누적 라이더 수 정확값 또는 "100+" 같은 표기 정책 |

옥대표님 1-line 답으로 위 3 placeholder fact 확정 → 본인 spec 본문 수정 → Alex 적용.

또는 **본인 default Persona Bible §4 그대로 적용 후 옥대표님 view 시 정정** — 옥대표님 페이스.

---

## 7. 정직 raise

- ✓ Image asset variants 변환 — iCloud File Provider deadlock 으로 cv2 bash access fail. Read tool 만 host path resolver 통과. 본 turn 에서 변환 완료 못 함 → **iCloud download 완료 후 본인 retry 진입 또는 옥대표님 직접 export → upload 대안**
- ⚠ Numeral content fact 옥대표님 직접 확정 — 본인 default Persona Bible §4 그대로 적용 (옥대표님 정정 시 본인 수정)
- ✓ DOM + CSS spec 그대로 — token 의존 명확, Alex 즉시 implement 가능
- ⚠ Founder section 의 design system 결정 — v1 (light, 메인 site) vs v2 (dark, 신규 dashboard/section) 어느 쪽 사용? **권장 v2** (dark Whoop/Vakaros founder portrait 톤 align) — 단 메인 사이트 light theme 와 충돌. 옥대표님 결정.

---

## 8. Sprint 묶음 path (CoS dispatch 권장)

옥대표님 라이브 view 시 **5 결정 동시**:

| # | 결정 | 영향 |
|---|---|---|
| 1 | Accent A/B/C (★ SEA / SUN / NEON) | `tokens.css --accent` 1줄 |
| 2 | Numeral fact 3건 (학위 / 올림픽 / 코칭) | `index.html founder section` 본문 |
| 3 | Light vs Dark theme for founder section | `<section class="founder">` 또는 `<section class="founder" data-theme="dark">` |
| 4 | §207 swap option (A/B/C) | `style/choppy-freeride.html` line 234 |
| 5 | GONG file delete (D/R/M/K) | `git rm` 또는 옥대표님 Finder |

5 결정 모두 옥대표님 1-line → 본인 후속 spec 정정 + Alex chain dispatch.

---

_Last updated: 2026-06-06_
_Founder section spec — DOM + CSS + image asset variants + Alex 핸드오프. iCloud file conversion retry standby. 옥대표님 5 결정 대기._
