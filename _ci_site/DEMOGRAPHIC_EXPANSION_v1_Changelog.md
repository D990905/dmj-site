# Demographic Expansion v1 — Changelog

**Date:** 2026-05-05
**Scope:** Phase 4-8 통합 build · matrix demographic axis + 3 신규 landing pages + nav·hero·level pages 정합 + typography 전수 fix
**Curator:** 단무지공방 / 옥덕필 (3회 올림픽 출전, 대한민국 윈드서핑 국가대표 수석코치)

## 0. 요약

기존 64-시나리오 매트릭스 (4 levels × 4 weights × 4 styles)에 **demographic 보정 레이어** 추가 — adult_male / adult_female / youth (13-17) / child (8-12) / senior (50+). 5개 segment에 wing offset · board volume · FDS 제외 · direct sale 차단 등 정밀 규칙 정의. Quiz 4-step → 5-step. 3개 신규 landing pages (women / junior / family) build. Nav 드롭다운·Hero 카피 demographic 항목 추가. 모든 level 페이지에 demographic-paths 섹션 inject. 타이포그래피 widow 방지·title 마침표 verb/noun 규칙 전수 적용.

## 1. 변경 list (파일 단위)

### 1.1 데이터·매트릭스
- `site/data/equipment_matrix.json` — `_meta.version` 1.2 → **1.3**. `_meta.demographic_adjustments` (5 segment 보정 규칙) + `_meta.demographic_messages` (5 segment headline·subline·warning) 추가. 64 entry는 그대로 유지 (보정은 runtime에서 적용).

### 1.2 Quiz (find-my-gear)
- `site/find-my-gear.html` — 4-step → **5-step**. 새 Step 1 "Q1 · Rider Profile" (성별·연령 5 옵션). KEY 배열·STEPS 배열·진행 progress 업데이트. child 옵션 선택 시 자동으로 result로 redirect (no_direct_sale path). matrix.js renderQuiz에 `{ demographic, sport }` opts 전달.

### 1.3 Matrix renderer
- `site/assets/js/matrix.js` — v1.3. `applyDemographicAdjustment(entry, key)` (wing_offset 적용·FDS 제외·deep clone). `renderChildPath()` (직접 sales 차단 별도 path 렌더). `renderQuizResult` 시그니처 옵션 객체 받음. `DEMO_LABELS`·`getDemographic`·`getDemographicMsg` 추가. base path 결정 로직에 women/junior/family 추가.

### 1.4 Style (CSS)
- `site/assets/css/style.css` — Korean typography policy 블록 추가 (`html[lang="ko"]` keep-all·overflow-wrap·hanging-punctuation, headings text-wrap balance, lead pretty, fallback max-width). `.mtx-demo-banner`·`.mtx-warning` 매트릭스 카드용 배너 클래스 추가.

### 1.5 신규 페이지 3개
- **`site/women/index.html`** — 여성 라이더 가이드 (5 problems / curated gear / 3-stage path / 1:1 CTA / interview placeholder).
- **`site/junior/index.html`** — 유소년·어린이 가이드 (safety banner · 부모 7 FAQ · 3-tier age cards · curated gear · WIP 안전 장비 강조 · lesson partnership placeholder).
- **`site/family/index.html`** — 가족 라이딩 가이드 (3 why family · 3 family scenarios · bundle 산출 항목 · 8 spot card · 가족 1:1 CTA).

### 1.6 Index·Nav·Hero
- `site/index.html` — 컨설팅 nav 드롭다운에 여성/유소년/가족 3 링크 추가 (desktop + mobile menu). Hero `<p class="hero__lead">`에 "성별·연령" keyword 추가. `hero__quick-tags` 3 태그 추가. (linter가 일부 lint 처리한 이력 있음 — 변경은 의도된 것.)
- `site/sitemap.xml` — women/junior/family URL 3 entry 추가 (priority 0.9).

### 1.7 Level pages 정합
- `site/level/{beginner,intermediate,advanced,pro}.html` — nav 드롭다운에 여성/유소년/가족 3 링크 추가. CTA 직전에 "Demographic-Specific Path" 섹션 inject (3 카드 — women/junior/family link).

### 1.8 Style pages 정합
- `site/style/{flat-speed,choppy-freeride,wave,hybrid}.html` — nav 드롭다운에 여성/유소년/가족 3 링크 추가.

### 1.9 Typography fix (전수)
- 모든 HTML 파일 (`site/**/*.html`) trailing-period scan + 정정:
  - **Verb-ending titles** (~다 / ~요 / 등 conjugation) → 마침표 유지 (예: "당신의 라이딩을 컨설팅합니다.")
  - **Noun-ending titles** → 마침표 삭제 (예: "한국 spot에 맞춘 컨설팅", "16조합 매트릭스 보기")
  - 영문 titles → 마침표 삭제
  - 3-stack rhythmic phrases (예: "너그럽다. 멀리 간다. 부드럽다.") → 마침표 유지 (다 ending)
- CSS `text-wrap: balance` (heading) + `text-wrap: pretty` (lead) + `word-break: keep-all` 전역 적용 → 한국어 widow 방지.

## 2. 신규 페이지 3개 (요약)

| 페이지 | URL | Hero | 주요 섹션 | 1:1 CTA |
|---|---|---|---|---|
| 여성 라이더 | `/women/` | "여성 라이더를 응원합니다." | 5 problems / curated gear (8 cards) / 3-stage path / interview placeholder | `https://pf.kakao.com/` 카톡 컨설팅 |
| 유소년·어린이 | `/junior/` | "다음 세대 라이더 안전한 첫 시즌" | Safety banner / 부모 7 FAQ / 3-tier age cards (13-17 / 8-12 / 8 미만) / 8 gear cards (vest·helmet 강조) / lesson partnership placeholder | 부모 1:1 컨설팅 (직접 sales 차단) |
| 가족 라이딩 | `/family/` | "가족이 함께 타는 윙포일" | 3 why-family / 3 family scenarios / bundle 산출 항목 / 8 spot 카드 (양양·강릉·동해·제주·한강·대청호·고성) | 가족 패키지 견적 |

## 3. 매트릭스 차원 확장 status

| segment | label_ko | default_weight | wing_offset | board_volume_offset_L | fds_excluded | no_direct_sale | priority |
|---|---|---|---|---|---|---|---|
| `adult_male` | 성인 남성 | mid-light | 0 | 0 | false | false | standard |
| `adult_female` | 성인 여성 | light | -1 | +5 | false | false | ergonomics |
| `youth` | 유소년 (13-17) | light | -2 | -10 | true | false | safety_cruise |
| `child` | 어린이 (8-12) | light | -3 | -20 | true | **true** | 1on1_consult_only |
| `senior` | 시니어 (50+) | mid-light | 0 | +10 | true | false | forgiveness_longevity |

**Runtime 적용**: Quiz 결과 렌더 시 entry의 `wing.sizes_m2`에 `wing_offset × 0.5m²` 가감 (floor 2.5). FDS excluded segment에서 `wing.primary === 'ppc-fds'`면 자동으로 `m1x`로 fallback. child segment는 직접 sales 차단 path로 redirect.

**Quiz step 변화**: 4 steps (level → weight → style → sport) → **5 steps** (demographic → level → weight → style → sport). Progress bar TOTAL=5.

**Nav 항목 변화**: 컨설팅 드롭다운 4 (입문자/초중급/상급자/선수레벨) → **7 (+ 여성/유소년/가족)**. 모바일 메뉴에도 동일 항목 추가.

## 4. Danny 검토 우선 항목 5건

1. **여성 라이더 wing offset = -1 (0.5m²)** 적정성 검토 — 한국 평균 여성 체중 대비 충분한가? 아니면 -2 (1.0m²) 더 보정할 것인가? `_meta.demographic_adjustments.adult_female.wing_offset` 값 결정 필요.
2. **child (8-12세) age threshold** 조정 필요성 — Danny 코칭 경험상 10세 미만 라이딩 진입은 어떻게 다뤘는지? 현재 8세를 floor로 잡았으나 9세·10세로 올릴 수도 있음.
3. **WIP Junior wetsuit·harness·vest XS/S 사이즈 spec** 정확성 — 본사 카탈로그에서 cm/kg 기준 size chart 가져와 명확화 필요. 현재 women/junior 페이지에 "XS/S" 라벨만 표시 — 신체 사이즈 cm/kg 첨부 권장.
4. **Family scenario 3개 ("Scenario A/B/C")**의 shifting demographics 적정성 — 한국 가족 윙·포일 entry user pattern과 일치하는지 Danny 직접 컨설팅 경험으로 검증.
5. **senior segment "fds_excluded: true"** 적정성 — 50+ 라이더라도 본인 운동 백그라운드(원·서핑·카이트 경력)에 따라 FDS 진입 가능한 case 있음. 일률 차단보다 "기본 차단·1:1 검토 시 해제" 정책 권장.

## 5. 알려진 이슈·후속 작업

- **이미지·콘텐츠 미완성** (Phase 9 별도 진행): 모든 brand SKU 공식 이미지 수집 + product description 한국 대화체 번역. 별도 phase로 launch 전 완성 필요. 메모리: `project_phase9_image_content.md`.
- **여성 라이더 인터뷰** (Coming Soon): Phase 6에서 한국 여성 라이더 3-5명 인터뷰 컨텐츠 추가 예정.
- **Lesson partnership 네트워크** (Coming Soon): 한국 윈드/카이트/SUP 협회 등록 강사 partnership 추가 (양양·강릉·제주·한강·대청호).
- **Choppy-freeride hero "ghost text" 보고건**: 스크린샷 분석 결과 실제 source에 해당 ghost text 없음 — 스크린샷 렌더링 artifact로 판단. 추가 검증 권장.
- **타이포그래피 widow 검증**: 1920·1440·1024·640·375 viewport에서 hero·section title widow 0건 검증 필요 (CSS rule 적용은 완료, 실제 렌더 검증 미실행).

## 6. Local preview 명령

```bash
# 단무지 site 폴더로 이동
cd "/Users/dannyok/Documents/Claude/Projects/단무지공방 홈페이지 만들기/site"

# 간단 정적 서버 (Python 3)
python3 -m http.server 8080

# 또는 Node http-server (npm i -g http-server 후)
npx http-server -p 8080 -c-1
```

브라우저에서:
- 메인: http://localhost:8080/
- Find My Gear: http://localhost:8080/find-my-gear.html
- 여성 라이더: http://localhost:8080/women/
- 유소년·어린이: http://localhost:8080/junior/
- 가족 라이딩: http://localhost:8080/family/
- Level beginner: http://localhost:8080/level/beginner.html

## 7. 검증 단계 (Phase 8 완료 후 실행 권장)

1. JSON valid 검증: `cd site/data && python3 -c "import json; json.load(open('equipment_matrix.json')); print('OK')"`
2. `find-my-gear.html` 5 demographic 모두 클릭 → result render 확인 (특히 child 차단 path)
3. 모든 hero·section title trailing-period grep 0건 확인 (verb-ending 제외)
4. 새 3개 landing 페이지 모바일 (390·320 viewport) 렌더 확인
5. Level 4 페이지 demographic-paths 섹션 카드 hover transition 확인
6. sitemap.xml 22개 URL XML valid 확인

---
[리브랜딩 2026-05-05: 단무지그룹 → 단무지공방 — Option A 채택. 이 changelog 안 '단무지공방'은 후속 일괄 치환 결과이며, 작성 당시 brand는 '단무지그룹'이었음.]
