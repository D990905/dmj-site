# Period audit report — 2026-05-16
**Rule:** Danny canonical 2026-05-05 — 동사 활용 어미(다/요/까/음/함/임/됨)는 마침표 유지, 명사·영문·숫자 끝은 제거, 본문 `<p>` 건드리지 않음.
**Scanned:** 111 HTML files in `site/` (excluded `_qa_screenshots/`, `_mapping_review/`)

## Summary

### Strict-scope targets (h1-h6, `<title>`, `og:title`/`twitter:title` meta, `<button>`, `<nav> <a>`, `*-title/*-headline/*-tagline/*-eyebrow/*-btn/*-cta/*-label` classes, `<dt>/<summary>/<legend>/<figcaption>/<caption>`)

| Category | KEEP (verb ending — already correct) | REMOVE (needs fix) | FLAG (ambiguous) |
|----------|---|---|---|
| h1 | 4 | 0 | 0 |
| h2 | 4 | 0 | 0 |
| hero/card title classes | 6 | 0 | 0 |
| `<title>` meta | 0 | 0 | 0 |
| `og:title` / `twitter:title` | 0 | 0 | 0 |
| `<button>` | 0 | 0 | 0 |
| `<nav> <a>` | 0 | 0 | 0 |
| `<dt>/<summary>/<legend>/<figcaption>/<caption>` | 0 | 0 | 0 |
| **TOTAL** | **14** | **0** | **0** |

**결론: strict 스펙 안에서는 자동 수정할 케이스가 0건.** 현재 마침표가 붙어있는 14개 타이틀은 전부 `~다.`/`~요.` 동사 활용 어미 → 정책상 유지가 맞음.

### KEEP-confirmed 샘플 (변경 없음 — 이미 정책 부합)

| File | Element | Text |
|------|---------|------|
| index.html | `<h1 class="hero__title">` | 당신의 라이딩을 컨설팅합니다**.** |
| index.html | `<h2 class="launch__title">` | 정식 launch 시, 가장 먼저 알려드릴게요**.** |
| index.html | h2 | 바로 상담이 가장 빠릅니다**.** |
| levitaz.html | `<h2 class="section-head__title">` | Free Series와 Race Series는 워런티가 다릅니다**.** |
| levitaz.html | h2 | 본인 spot에 맞는 Levitaz 조합, 찾아드립니다**.** |
| style/wave.html | `<h1 class="cons-hero__title">` | Wave 라이딩을 컨설팅합니다**.** |
| style/flat-speed.html | `<h1 class="cons-hero__title">` | Flat·Speed 라이딩을 컨설팅합니다**.** |
| women/index.html | `<h1 class="demo-hero__title">` | 여성 라이더를 응원합니다**.** |
| takoon.html | `<p class="brand-hero__tagline">` | 윙·SUP 포일·펌핑포일 합리적이지만, 흔한 보급형은 아닙니다**.** |

## Edge cases — Danny 결정 필요 (스펙 모호, 자동 수정 X)

### A) `<span class="character-nick">` — 카드 sub-tagline (6건)
카드 구조: `h3.sku-card__name` → `span.character-nick` (현재 검사 대상) → `p.sku-card__char`
스펙상 "card title"이 아니라 카드 sub-label/tagline. "card title"로 간주하면 제거, "본문 prose"로 간주하면 유지.

| File | 텍스트 | 끝 |
|------|---------|----|
| takoon.html | "무난한 첫 친구" — 안정 우선, 실수에 여유로운 **wing.** | g |
| takoon.html | "친절한 진화" — 신소재 4중 ripstop, 입문 → 중급 끊김 없는 **다리.** | 리 |
| takoon.html | "freefly 친구" — forgiving한 고급, 직관적 **컨트롤.** | 롤 |
| takoon.html | "준비 중" — Takoon의 race-grade dual skin, 본사 발표 **대기.** | 기 |
| ppc.html | "나비" — 부드럽고 가볍고, 손목 피로 없이 한 호흡 **더.** | 더 |
| ppc.html | "장르가 다르다" — Full Skin, 최상위 racing **tier.** | r |

### B) `<span class="sc-cat-card__note">` — 카드 설명 span (5건)
카드 구조: `__en` 영문명 → `__kr` 한글명 → `__note` (현재 검사 대상). `<p>` 아닌 `<span>` 이지만 body 성격. 두 문장 이상 들어있는 케이스 다수.

| File | 텍스트 | 끝 |
|------|---------|----|
| products/wip/size-chart.html | 가슴둘레 + 체중 기준. 50N 부력 인증, fitting **타이트하게.** | 게 |
| products/wip/size-chart.html | 신장·체중·가슴 3축. 한국 사계절 — 3/2mm·4/3mm·5/4mm 두께별 **선택.** | 택 |
| products/wip/size-chart.html | 허리둘레 기준. Wing Belt 4.0 / Waistfoil 3.0 — 둘 다 같은 사이즈 **spec.** | c |
| products/wip/size-chart.html | 허리둘레 기준. 라이딩 도중 윙 부담 분산 — fitting 살짝 **타이트.** | 트 |
| products/wip/size-chart.html | S-M / L-XL 2-tier. 머리 둘레 기준 헬멧과 **동일.** | 일 |

### C) 학술 인용 `<strong>` / `<em>` in glossary.html (5건)
APA/MLA 인용 관례. 저자명의 initial은 마침표가 필수이고 책 제목 마침표도 인용 표기 표준. 정책 적용 불필요로 추정.

| File | 위치 | 텍스트 |
|------|------|--------|
| glossary.html | `<strong>` | Anderson, John **D.** |
| glossary.html | `<strong>` | Hoerner, S.**F.** |
| glossary.html | `<strong>` | Folkersma, M.; Schmehl, R.; Viré, **A.** |
| glossary.html | `<em>` | Fluid-Dynamic Drag: Practical Information on Aerodynamic Drag and Hydrodynamic **Resistance.** |
| glossary.html | `<em>` | Hydrodynamics of High-Speed Marine **Vehicles.** |

### D) QA test 페이지 1건
| File | 텍스트 |
|------|--------|
| _qa_agent_deny_test.html | 이 페이지는 검증 전용입니다 (noindex,**nofollow).** |
QA 전용 페이지 — 공개 노출 없음. 정책 적용 우선순위 낮음.

## 권고

1. **Strict-scope (h1-h6 / title / button / nav / *-title 클래스)**: 추가 자동 수정 불필요. 현 상태가 정책 부합.
2. **Edge case A (`character-nick` 6건)**: Danny 결정 필요 — 이 sub-tagline을 "card title"로 분류할지 "card body"로 분류할지. "card title"이면 6건 모두 마침표 제거.
3. **Edge case B (`sc-cat-card__note` 5건)**: `<p>` 아닌 `<span>`이지만 multi-sentence body 성격이 강함. 정책상 본문 paragraph 취급 권장 (유지).
4. **Edge case C (citations 5건)**: 학술 인용 관례. 유지 권장.
5. **Edge case D (QA test)**: 노출 없음, 우선순위 낮음. 보류 가능.

---
*Audit method: Python + BeautifulSoup. Comment 노드는 제외. `<p>` 내부 자손은 본문으로 간주하고 strict-scope에서 제외. 정책 키워드 매칭: `title|headline|tagline|eyebrow|label|btn|button|cta|tab|menu-link|nav-link` with `lead|copy|desc|sub|body|note|txt` 제외.*
