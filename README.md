# 단무지공방 — Phase 1 HTML 정적 사이트

`dmjgroup.kr` Phase 1 launch용 HTML 정적 사이트. Phase 2 Cafe24 e-commerce 본격 launch 전 brand 인지·lead generation 단계 site.

> **빌드 일자**: 2026-05-05
> **목표**: 글로벌 best-in-class 수준
> **반복**: 단계별 incremental build (Step 1~6)

---

## 디자인 시스템

- **Color**: Deep navy `#0A2540` (primary) · Sea blue `#1F8FFF` (secondary) · Sun yellow `#FFB800` (accent)
- **Typography**: Pretendard Variable (한국어) + Inter (영문/숫자) + JetBrains Mono (스펙)
- **Layout**: 4px base spacing scale, 1280px container, mobile-first responsive
- **Motion**: 180~420ms ease-out, IntersectionObserver scroll reveal
- **참조**: `Site_Concept/03_DMJ_Concept_Brief.md` · `04_Reference_Inspiration.md`

---

## 파일 구조

```
site/
├── index.html              # 홈 (hero · 4 brand · persona · perf signature · launch alert)
├── levitaz.html            # Levitaz brand hub (Free Series 4 SKU + perf 5축)
├── ppc.html                # PPC brand hub (All-around lineup + perf 5축)
├── takoon.html             # Takoon brand hub (Entry 윙·세일 + perf 5축)
├── wip.html                # WIP brand hub (보호장비 + perf 5축)
├── 404.html                # 404 페이지
├── robots.txt              # 검색엔진 크롤링 규칙
├── sitemap.xml             # 9 URL 사이트맵
├── policy/
│   ├── privacy.html        # 개인정보처리방침
│   ├── refund.html         # 환불·교환 정책
│   ├── shipping.html       # 배송 정책
│   └── terms.html          # 이용약관
└── assets/
    ├── css/style.css       # 디자인 시스템 + 모든 컴포넌트 (1650줄)
    ├── js/main.js          # 인터랙션·5축 SVG 차트 (233줄)
    └── images/             # Phase 2 image 자산 폴더 (현재 비어있음)
```

> **참고**: `catalog.html` · `policies.html`은 이전 버전의 잔재 파일이며 새 navigation에서 link되지 않습니다 (필요 시 정리 가능).

---

## Local Preview

```bash
cd site
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000 접속
```

또는 `index.html` 파일을 직접 더블클릭 (file:// 프로토콜은 일부 폰트 CDN 차단 가능 — http.server 권장).

---

## Phase 2 Cafe24 전환 계획

본 Phase 1 site는 Cafe24 launch 후 다음과 같이 활용:

1. **Visual identity carry-over**: `style.css` 디자인 토큰 (color, typography) → Cafe24 theme 커스터마이징 시 그대로 적용
2. **콘텐츠 reuse**: brand hub 4 페이지의 한국어 카피·spec table·5축 데이터 → Cafe24 brand category 페이지 콘텐츠로 그대로 이관
3. **Performance 5축 component**: `main.js`의 `renderPerfPentagon()` 함수 → Cafe24 product description HTML에 SVG 통째로 삽입 가능
4. **Launch alert 이메일 list**: 사전 등록 이메일 → Phase 2 launch 전 사전 알림 발송 (Cafe24 CRM)
5. **정책 4 페이지**: 한국 e-commerce 표준 기반 → Cafe24 약관 페이지 그대로 import

---

## dmjgroup.kr 도메인 연결 (Cafe24 호스팅 시)

1. Cafe24 가비아·후이즈 등에서 `dmjgroup.kr` 도메인 확인·구입
2. DNS 관리에서 A record `@` → Cafe24 호스팅 IP, CNAME `www` → Cafe24 호스트명 입력
3. 또는 단순 정적 호스팅 (Phase 1만):
   - GitHub Pages: `site/` 폴더 push → repo Settings에서 custom domain `dmjgroup.kr` 설정
   - Cloudflare Pages, Vercel, Netlify 모두 동일 패턴
4. SSL: Cloudflare 또는 호스팅 자동 발급

---

## Placeholder 목록 (Phase 2 capture·확정 필요)

| 위치 | 항목 | 비고 |
|---|---|---|
| 모든 brand card | 실제 brand image | 현재 그라데이션 + 모노그램 |
| 모든 SKU card | 실제 product 사진 | 현재 dashed border placeholder |
| Hero | full-bleed 라이프스타일 image | 현재 그라데이션 + grid pattern |
| 가격 (Levitaz) | 정식 KRW 환산 | 현재 RRP × 1.6 추정값 |
| 가격 (PPC/Takoon/WIP) | 본사 RRP 수령 후 확정 | 현재 "[Phase 2 확정]" |
| Footer 사업자 정보 | 통신판매업신고번호 | 현재 "[신고 예정]" |
| OG image | `/assets/images/og-default.jpg` | Phase 2 제작 필요 |

---

## Launch Alert form

`index.html`의 launch form은 두 가지 모드 지원:

- **mailto fallback (현재 default)**: 폼 submit 시 `hello@dmjgroup.kr`으로 mail client 열림
- **Formspree/Tally 등 endpoint**: `<form data-endpoint="https://formspree.io/...">` 로 변경하면 직접 POST

Phase 2에서는 Cafe24 회원 가입·뉴스레터 list로 통합.

---

## Browser Support

- Modern evergreen browsers (Chrome, Edge, Safari, Firefox 최신)
- iOS Safari 14+, Android Chrome 90+
- IE 11 미지원 (CSS variables, IntersectionObserver, fetch 사용)
- `prefers-reduced-motion` 사용자 자동 motion off

---

## 산출 요약

| 페이지 | line수 | 사이즈 |
|---|---|---|
| index.html | 637 | 36KB |
| levitaz.html | 392 | 28KB |
| ppc.html | 248 | 20KB |
| takoon.html | 249 | 20KB |
| wip.html | 250 | 20KB |
| 404.html | 74 | 8KB |
| policy 4종 | ~556 | ~44KB |
| style.css | 1650 | 52KB |
| main.js | 233 | 12KB |
| **합계** | **~4,300줄** | **~284KB** |

CDN dependency: Pretendard (jsdelivr), Inter + JetBrains Mono (Google Fonts).
