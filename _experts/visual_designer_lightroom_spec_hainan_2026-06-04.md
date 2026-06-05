# Lightroom 보정 spec — Hainan Hero 사진

| 항목 | 내용 |
|---|---|
| 문서 유형 | Lightroom Develop 단계별 보정 지시서 (옥대표님 직접 작업용 reference) |
| 원본 | `IMG_0388.JPG` (1600×1066, sRGB, 2025 中国 全国风翼锦标赛, 옥대표님 본인 사진 · license clear) |
| 목표 | brand "warm sea sunset" 톤 align · dehaze 로 도시 silhouette + 하늘 contrast 확보 · sponsor logo / 워터마크 crop X (옥대표님 결정) |
| ETA | Lightroom 15-30 분 (Classic) / 20-40 분 (Mobile) |
| 출력 | `wing-hainan-china-1.{jpg,webp,sm.webp}` 3 files → `site/assets/images/products/ppc/lifestyle/` |
| 작성 | Visual Designer (Rose Yoon) · 2026-06-04 |

> **읽는 법.** Step 0 = import + preset 시작점 · Step 1-5 = Develop module 의 정확한 slider + 권장값 + 효과 1줄 · Step 6 = export 3 file · Step 7 = 자체 5 체크리스트. 슬라이더 값은 reference 일 뿐, 옥대표님 visual feedback 우선 — slider 끌면서 미세 조정.

---

## Step 0 — Import + Preset 시작점

**Classic / Mobile 공통**:
1. **Import** — `IMG_0388.JPG` 카탈로그 추가
2. **Camera Profile** (Calibration 탭 또는 Profile dropdown) — `Adobe Standard` 또는 `Camera Standard`. **Adobe Landscape 비권장** (이미 saturated 됨)
3. **Lens Corrections** — `Enable Profile Corrections` ✓ + `Remove Chromatic Aberration` ✓
4. **Crop** — **변경 X** (옥대표님 결정 = sponsor logo / 워터마크 유지)

---

## Step 1 — Basic panel (가장 큰 변화)

**WB (White Balance)** — Temp + Tint 슬라이더

| Slider | From | To | 효과 |
|---|---|---|---|
| Temp | 4800 | **6000K** | 산업 hazy gray cool → warm sea sunset (★ 가장 critical) |
| Tint | 0 | **-6** | slightly cooler magenta, R-G 균형 |

**Tone** — Exposure 부터 Blacks 까지 6 slider

| Slider | 값 | 효과 |
|---|---|---|
| Exposure | **+0.15** | 배경 살짝 밝게 (lift) |
| Contrast | **+12** | flat → dimensional |
| Highlights | **-18** | overbright 하늘 일부 회복 (sky detail) |
| Shadows | **+22** | 라이더 face / wetsuit detail 회복 |
| Whites | **+10** | white wing 의 highlight clip |
| Blacks | **-8** | 라이더 black wetsuit 안정 |

**Presence** — Texture / Clarity / Dehaze / Vibrance / Saturation 5 slider

| Slider | 값 | 효과 |
|---|---|---|
| Texture | **+8** | 도시 silhouette 빌딩 outline 살아남 |
| Clarity | **+15** | mid-tone contrast (sharp 느낌 강화) |
| **Dehaze** | **+28** | ★ 가장 dramatic — 하늘 + 도시 atmospheric haze 제거 |
| Vibrance | **+25** | saturated 보다 자연 (선택적 saturation) |
| Saturation | **+6** | 전체 미세 boost (vibrance 후 보강) |

**Mobile 차이**: Lightroom Mobile 의 `Effects` 패널은 separate. Dehaze 가 Effects 안. 다른 slider 위치 동일.

---

## Step 2 — HSL / Color panel (선택 색 정교 보정)

**Blue (sky 강조)** — 라이더 yellow vest 의 대비 강조

| Hue | Saturation | Luminance |
|---|---|---|
| 0 | **+22** | **-8** |

**Yellow (wing + vest)** — brand sun (#FFB800) 톤 align

| Hue | Saturation | Luminance |
|---|---|---|
| **+3** | **+12** | **+3** |

**Cyan (water)** — sea 톤 강조

| Hue | Saturation | Luminance |
|---|---|---|
| 0 | **+18** | 0 |

**Orange (sea horizon · 일부 building 톤)** — warm 강화

| Hue | Saturation | Luminance |
|---|---|---|
| **+5** | **+8** | **+2** |

**다른 hue** (Red · Green · Aqua · Purple · Magenta) — 변경 0

---

## Step 3 — Color Grading (구 Split Toning, warm 톤 final)

**Classic** — Color Grading 패널 (3-point: Shadows / Midtones / Highlights):

| Region | Hue | Saturation | Luminance |
|---|---|---|---|
| Highlights | 50° (warm yellow) | 5 | 0 |
| Midtones | 45° (warm yellow) | 8 | 0 |
| Shadows | 220° (cool blue) | 3 | 0 |

**Mobile** — Color Mix 또는 Split Toning (구버전):
- Highlights: Hue 50, Sat 5
- Shadows: Hue 220, Sat 3

**효과**: warm shift 가 midtone 중심 (라이더 wetsuit · 물 · 도시) 에 집중. shadow 의 cool blue 가 balance (전체 yellow cast 방지).

---

## Step 4 — Detail (sharpening + noise)

**Sharpening**

| Slider | 값 |
|---|---|
| Amount | 40 |
| Radius | 1.0 |
| Detail | 25 |
| Masking | **30** (★ 텍스처 영역만 sharpen, 부드러운 영역 보존) |

**Noise Reduction** (low ISO 이므로 minimal)

| Slider | 값 |
|---|---|
| Luminance | 10 |
| Detail | 50 |

---

## Step 5 — Effects (선택 — 옥대표님 취향)

**Post-Crop Vignetting** (선택):
- Amount: -8 (subtle, 라이더 가운데 강조)
- Midpoint: 60
- Roundness: 0
- Feather: 70

**Grain** (선택, film feel):
- Amount: 0 (변경 X 권장 — sponsor logo 가 noise 와 함께 너무 grungy)

---

## Step 6 — 출력 (3 file)

### File 1 — Hero desktop (JPEG)

**Export Settings**:
- File Format: **JPEG**
- Quality: **88**
- Color Space: **sRGB**
- Image Sizing: `Long Edge 1920px` (또는 원본 1600px 유지)
- Resolution: 144 ppi (web)
- Sharpen For: Screen, Standard
- Metadata: Copyright + Contact only (camera info 제거)

**File Name**: `wing-hainan-china-1.jpg`

### File 2 — Hero modern (WebP)

- File Format: **WebP** (Classic 의 export plugin 필요 또는 Photoshop "Export As" 또는 Squoosh.app)
- Quality: **82**
- Color Space: sRGB
- Long Edge: 1920 (또는 원본 1600)

**File Name**: `wing-hainan-china-1.webp`

### File 3 — Mobile fallback (WebP small)

- Format: WebP
- Quality: **78**
- Long Edge: **960px**

**File Name**: `wing-hainan-china-1-sm.webp`

### 저장 위치

옥대표님 Mac 의 Lightroom export folder 또는 Desktop. 3 file 한 폴더에.

---

## Step 7 — 자체 5 체크리스트 (export 전 OK 판정)

slider 값은 시작점 — 옥대표님 visual feedback 우선. **export 전 5 항목 모두 ✓ 확인**:

| # | 항목 | 정상 |
|---|---|---|
| 1 | 하늘이 hazy gray → light blue 변경 (dehaze 효과 가시) | ✓ |
| 2 | 도시 silhouette 의 빌딩 outline 선명 (희미했던 detail 살아남) | ✓ |
| 3 | 물 색이 light blue-gray → vibrant sea blue (HSL Cyan + Blue boost) | ✓ |
| 4 | 라이더 yellow vest + wing yellow 가 brand sun (#FFB800) 톤과 isomorphic | ✓ |
| 5 | 전체 색온도 cool → warm shift (WB + Color Grading 합산) | ✓ |

**4/5 미달**: Step 1-3 의 slider 미세 조정. 가장 영향 큰 slider 는 **Dehaze (#1·#2)** + **WB Temp (#5)** + **HSL Blue (#3)**.

**5/5 OK**: Step 6 export 3 file.

---

## Step 8 — Handoff (옥대표님 → 본인 Rose)

**옥대표님 작업 완료 후**:
1. 3 file (`wing-hainan-china-1.{jpg,webp,sm.webp}`) export 완료
2. 본인 (Rose) 가 처리할 수 있게 다음 중 한 방법:
   - **(a)** `site/assets/images/products/ppc/lifestyle/` 폴더에 직접 갖다 놓기 (Finder, 기존 sandbox 의 v3 placeholder file 자동 overwrite)
   - **(b)** Cowork session 에 attachment 로 업로드 (3 file 또는 ZIP)
   - **(c)** iCloud 또는 다른 cloud 에 올리고 link 보내기

**본인 (Rose) 후속 작업**:
- `style/flat-speed.html` hero 적용 (primary)
- `index.html` Consultation Hub 직전 lifestyle banner 적용 (secondary)
- `<picture>` tag + `srcset` 설정 (mobile fallback) + `loading="eager" fetchpriority="high"` (LCP 최적)
- commit + push (옥대표님 명시 또는 `auto_push.command` whitelist 가 `assets/images/*` 포함 시 자동)

---

## Step 9 — Sandbox v3 file 처리 (Rose 보고)

⚠ **현재 sandbox 상황 정직 보고**: 본인 OpenCV v3 시도 결과 file 3 개가 `assets/images/products/ppc/lifestyle/` 에 이미 save 됨. 옥대표님 결정대로 폐기해야 하나 **본인 sandbox delete 권한 denied** (`mcp__cowork__allow_cowork_file_delete` 도 permission denied).

처리 방법 3 옵션 (옥대표님 선택):

| Option | 처리 |
|---|---|
| **A** (권장) | 옥대표님 Lightroom 보정 결과 file 을 같은 이름으로 OS 의 site 폴더에 갖다 놓기 → 자연 overwrite. v3 placeholder 자동 폐기 |
| **B** | 옥대표님 Finder 에서 직접 3 file delete (`wing-hainan-china-1.jpg/webp/sm.webp`) → 본인이 다시 같은 이름 옥대표님 보정 file 으로 commit |
| **C** | 본인 commit 시 git stage 단계에서 제외 (옥대표님 보정 결과 file 만 stage). v3 placeholder 는 working tree 잔재 |

**Visual 권장: A** — 옥대표님 추가 작업 0, 자연 overwrite.

---

## 부록 — Lightroom Mobile (iPad / iPhone) 특이사항

Lightroom Mobile 에서 작업 시:
- Develop tab → Light · Color · Effects · Detail · Optics · Geometry 6 패널
- Light = Tone (Step 1 의 Tone 영역)
- Color = WB + HSL (Step 1 WB + Step 2 HSL)
- Effects = Dehaze · Vignette · Grain · Texture · Clarity (Step 1 Presence 일부 + Step 5)
- Color Mix = HSL (Step 2 와 동일)
- Color Grading 은 별도 패널

**기능 차이**:
- Color Grading 의 3-point UI 가 Classic 보다 단순. Hue/Sat 위주
- Sharpening 의 Masking slider 가 Pro tier 만 (free 면 fallback 값)
- WebP export 는 Mobile 에 native 없음 → JPEG 만 export 후 Mac 에서 변환 또는 Squoosh.app (browser)

---

_Last updated: 2026-06-04 14:25 KST_
_옥대표님 직접 Lightroom 보정 reference. slider 값은 시작점 — visual feedback 우선._
