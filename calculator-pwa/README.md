# DMJ Lifting Calculator — PWA

윙포일 라이딩 윙 사이즈·속도 계산기. 단무지공방 사이트 안 calculator.html 의 mobile-first PWA port.

## 파일 구조

```
site/calculator-pwa/
├── index.html               (15.7 KB) — PWA shell
├── style.css                (18.3 KB) — mobile-first CSS
├── app.js                   (23.6 KB) — UI controllers + SW register + A2HS prompt
├── manifest.webmanifest     ( 1.2 KB) — PWA manifest (standalone · navy theme)
├── sw.js                    ( 2.6 KB) — Service Worker (cache-first app shell)
├── README.md                — 이 파일
└── js/
│   ├── lift-calculator.js   (70.1 KB) — 물리 엔진 (그대로 복사)
│   └── foil-presets.js      ( 5.9 KB) — 30+ foil preset (Levitaz·Takoon·Chubanga·North)
└── icons/
    ├── icon.svg             ( 1.8 KB) — master SVG (any purpose)
    ├── icon-maskable-src.svg( 1.6 KB) — maskable source (safe-zone padded)
    ├── favicon.svg          (   .3 KB) — 32px favicon
    ├── icon-192.png         ( 6.3 KB) — Android home·iOS apple-touch-icon
    ├── icon-512.png         (21.2 KB) — Android splash·large
    └── icon-maskable.png    (12.3 KB) — Android adaptive icon
```

**전체 사이즈**: 약 178 KB (HTML+CSS+JS 60 KB · 엔진 70 KB · icons 42 KB)

## 검증 상태

| 항목 | 결과 | 비고 |
|---|---|---|
| JS syntax (4 file) | ✅ PASS | `node --check` |
| Engine self-test | ✅ 62/62 PASS | `DMJLift.runSelfTest()` |
| Danny matrix regression | ✅ PASS | max Δ_raw 0.131 (tol 0.30) |
| Manifest JSON | ✅ valid | 14 fields, 4 icons |
| DOM ↔ JS id refs | ✅ 0 mismatch | a2hs-go/a2hs-x = dynamic inject (의도) |
| 시각 회귀 (mobile 390px) | ⚠ 미실행 | 샌드박스 disk full — host 측 직접 확인 권장 |

## Danny 본인 폰 설치 — Step-by-Step

### 옵션 A: 로컬 macOS 호스트 + 같은 wifi 폰 접속 (즉시 가능)

**Mac 에서**:
```bash
cd ~/Documents/Claude/Projects/단무지공방\ 홈페이지\ 만들기/site/calculator-pwa
python3 -m http.server 8080
```

Mac 의 로컬 IP 확인 (예: `192.168.1.42`):
```bash
ipconfig getifaddr en0
```

**폰에서 (같은 wifi)**:
1. Safari (iOS) 또는 Chrome (Android) 에서 `http://192.168.1.42:8080/` 접속
2. iOS: 하단 공유 버튼 → "홈 화면에 추가" 탭 → 이름 확인 → 추가
3. Android: 우상단 ⋮ → "홈 화면에 추가" 또는 자동 install prompt (노란 배너) 가 뜨면 "설치" 탭

**주의**: http (https 아님) 환경에서는 Service Worker 가 **localhost 외에는 등록 안됨**. 폰의 wifi IP 로 접속하면 SW 미등록 → 캐시 없음. 즉시 사용은 가능하지만 오프라인 기능은 안 됨.

→ 오프라인 캐시까지 작동시키려면 옵션 B 또는 C.

### 옵션 B: dmjgroup.kr 사이트에 deploy (권장)

기존 단무지공방 사이트와 같이 배포:
```
https://dmjgroup.kr/calculator-pwa/
```

이미 site/calculator-pwa/ 안에 들어있으므로 사이트 빌드·배포 시 자동 포함. https 환경 → SW 등록 OK → 오프라인 캐시 작동.

설치:
1. Safari (iOS) 또는 Chrome (Android) 에서 `https://dmjgroup.kr/calculator-pwa/` 접속
2. iOS: 공유 → 홈 화면에 추가
3. Android: 자동 prompt 또는 메뉴 → 앱 설치

### 옵션 C: ngrok 으로 임시 https 터널 (베타 테스트용)

```bash
cd ~/Documents/Claude/Projects/단무지공방\ 홈페이지\ 만들기/site/calculator-pwa
python3 -m http.server 8080 &
ngrok http 8080
```

ngrok 이 발급한 `https://xxxx-xx-xx.ngrok-free.app` URL 을 라이더에게 공유. 임시 https → SW 등록 OK.

## 로컬 시각 검증 (mac 에서 직접)

```bash
cd ~/Documents/Claude/Projects/단무지공방\ 홈페이지\ 만들기/site/calculator-pwa
python3 -m http.server 8080
```

Chrome 열고 `http://localhost:8080/` → DevTools (Cmd+Opt+I) → 좌상단 device toggle (Cmd+Shift+M) → iPhone 14 (390×844) 선택 → 새로고침.

검증할 것:
- App bar (navy + 노란 L↑ 마크) 상단 sticky
- 입력 card 의 number input 들이 iOS 자동 zoom 발생 X (font-size 16px 보장)
- 라디오 버튼이 touch friendly (min 44×44px) — 누르면 노란 sun 색 highlight
- 결과 card 의 v_min / v_target 숫자가 큰 monospace (28px+)
- Wing bracket (Min/Optimal/Max) 3 셀이 가로로 균등 분포
- VMG advisor 가 보이는지 (light blue 배경)
- Collapsible "📐 이론 측정값" 섹션이 기본 접힘 상태
- Application → Manifest 탭에서 manifest 가 정상 파싱
- Application → Service Workers 탭에서 SW 등록 OK
- Lighthouse 탭 → PWA category 실행 → score 확인

## API 노출 (engine binding)

`window.DMJLift` 전역에 아래 함수 노출 (lift-calculator.js):

- `calculate(opts)` — v_min/v_target 산출
- `recommendMinFeasibleWingSize(opts)` — 부상 가능 최소 윙
- `recommendTakeoffWing(opts)` — 역산 윙 사이즈
- `wingSizeOptimal(opts)` — WSO 6-pt matrix (Min/Opt/Max)
- `upwindAdvisor(opts)` — VMG 어드바이저 (top 5 suggestions)
- `runSelfTest()` — 62 케이스 자가진단
- `runDannyMatrixTest()` — Danny 본인 matrix regression

`window.DMJ_FOIL_PRESETS` (foil-presets.js): 30+ foil preset (Levitaz·Takoon·Chubanga·North).

## 향후 (V2 candidate)

PWA MVP 검증 후 Danny 결정 시 React Native 또는 Flutter 로 native rewrite. PWA 의 iOS 제약 (push notif 불가, 백그라운드 제한) 이 실제 사용 시 병목이 되면 native 이전 고려.

## iOS PWA 제약 (인지)

- **Push notification** = 불가 (Safari PWA 한정 — iOS 16.4+ 부터 web push 일부 지원하나 PWA 컨텍스트에서만)
- **백그라운드 처리** = 제한 (15분 후 SW idle)
- **standalone display** = OK (홈 화면 추가 후 status bar·notch 처리 모두 정상)
- **카메라/위치/푸시** = 일부 제한적

→ Calculator 기능 자체는 모두 작동 (오프라인 계산 OK, localStorage 사용 X).

## 빌드·배포 notes

빌드 step 없음 — 정적 HTML/CSS/JS 만으로 작동. Nginx·Apache·GitHub Pages·Netlify·Cloudflare Pages 등 어디든 정적 호스팅 가능.

기존 단무지공방 사이트 영향 0 — `site/calculator-pwa/` 폴더 내부에서만 작동, 사이트 다른 페이지 수정 0건.
