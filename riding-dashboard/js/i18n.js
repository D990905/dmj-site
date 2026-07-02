/* ============================================================
 * i18n.js — 라이딩 분석 대시보드 한↔영 토글 (Danny 2026-05-25)
 *
 * 아키텍처
 *  · 소스-텍스트-키 (source-as-key) 방식 — 한국어 원문을 키로 영어 매핑.
 *    호출부에서 RDI18n.T('한국어 텍스트') 또는 T('한국어 {n}개', {n:5}) 사용.
 *  · DOM 자동 번역 — 렌더 후 텍스트노드/속성을 walk 해 사전과 매칭되는
 *    한국어를 영어로 치환. 호출부 수정 없이 정적 HTML·동적 innerHTML
 *    모두 자동 처리. 원문은 _rdOrig 에 보존해 ko 로 토글 시 복원.
 *  · MutationObserver — 렌더로 새로 들어온 노드를 자동 번역.
 *  · 캔버스 텍스트(Chart.js·custom canvas) — DOM walk 가 닿지 않아
 *    호출부에서 T() 래핑 필요. lang 변경 시 RDDashboard 가 renderDashboard
 *    재호출 → 차트 재생성 → T() 가 'en' 분기 반환.
 *  · localStorage 키 = dmj_rd_lang ('ko'|'en'). 기본 'ko'.
 *  · 토글 버튼 = data-rd-lang-btn="ko|en" 속성. setupToggle 자동 결선.
 * ============================================================ */
(function (global) {
  'use strict';

  var STORE_KEY = 'dmj_rd_lang';

  /* ============================================================
   * 한↔영 사전 — source(ko) → target(en)
   * 키는 한국어 원문 그대로(공백·구두점 포함). 동적 보간은 {name} 토큰.
   * 추가 시 알파벳 순서 무관 — JS 객체 키 직접 조회(O(1)).
   * ============================================================ */
  var MAP = {
    /* ─── §401 PDF v1 port (옥대표님 2026-06-07 "go v1") — Phase 0-3 키 ─── */
    '풍향 확정 후 종합 평가 활성화': 'Activate full evaluation after wind direction confirmed',
    '오늘 = 시즌 베스트급 (top {p}%)': "Today = season best (top {p}%)",
    '오늘 = 우수한 세션 (A 등급)': "Today = excellent session (Grade A)",
    '오늘 = 시즌 평균 대비 {d}% 빠름': "Today = {d}% faster than season average",
    '오늘 = 양호한 세션 (B 등급)': "Today = good session (Grade B)",
    '오늘 = 시즌 평균 수준 ({p} percentile)': "Today = season average ({p}th percentile)",
    '오늘 = 보통 수준 (C 등급)': "Today = average (Grade C)",
    '오늘 = 평균 미달 — 회전 효율 개선 필요': "Today = below avg — improve maneuver efficiency",
    '오늘 = 풍속·컨디션 한계': "Today = wind/condition limit",
    '시즌 분포 추정': 'Season distribution estimate',
    '세션 peak': 'Session peak',
    '전체 회전 평균': 'All maneuvers average',
    '수직 vs 측면 효율': 'Upwind vs side efficiency',
    '가속·VMG': 'Acceleration · VMG',
    '풍향 확정 시 다음 세션 권장 활성화': 'Next session recommendation after wind confirmed',
    '다음 세션 윙 {w} m² 시도 (+{d} kt VMG)': 'Next session: try {w} m² wing (+{d} kt VMG)',
    '지속 — 동일 컨디션에서 회전 1-pass 비중 ↑': 'Continue — increase 1-pass maneuvers in same conditions',
    '다음 세션 14kt 임계 5분 유지 + 회전 1-pass 비중 ↑': 'Next: hold 14kt threshold 5min + increase 1-pass maneuvers',
    '다음 세션 자이브 -2초 손실 목표 + 1-pass 비중 70%↑': 'Next: jibe -2sec loss target + 1-pass 70%+',
    '다음 세션 풍상 VMG % target 85%↑ + 회전 efficient': 'Next: upwind VMG % target 85%+ · efficient maneuvers',
    '다음 세션 풍하 가속·VMG ↑ + 자이브 손실 -2초': 'Next: downwind acceleration·VMG up · jibe loss -2sec',
    '다음 세션 ': 'Next session ',
    ' 개선 — 동일 컨디션 재시도': ' improve — retry same conditions',
    'Top 3 Highlights': 'Top 3 Highlights',
    '오늘 세션': 'Today Session',
    '다음 세션': 'Next Session',
    '산출 대기': 'Pending',
    '풍상': 'Upwind',
    '종합': 'Overall',
    '풍하': 'Downwind',
    'vs 시즌 평균': 'vs Season Avg',
    'vs baseline': 'vs Baseline',
    '평균 속도': 'Avg Speed',
    '최고 속도': 'Max Speed',
    '회전 효율': 'Maneuver Eff',
    'VPS 풍상': 'VPS Upwind',
    'VPS 풍하': 'VPS Downwind',
    '강점': 'Strength',
    '개선': 'Improve',
    '관찰': 'Observe',
    '모두 양호 — 다음 컨디션 challenge': 'All good — challenge next conditions',
    '제한점': 'Limitations',
    '풍향 추정 신뢰도: ': 'Wind estimate confidence: ',
    ' — 리칭 일색 세션은 추정 정합성 약함': ' — reaching-only sessions have weaker estimates',
    '실측': 'Measured',
    '추정': 'Estimate',

    /* ════════════════════════════════════════════════════════════
     * §410 — 영문 모드 한글 잔존 전수 sweep (옥대표님 verbatim 2026-06-10)
     *  라이브 audit(.audit-410)으로 검출한 잔존을 정정. 다수는 소스에서
     *  i18nT 로 enum/label 을 래핑(app.js)했고, 아래는 그 템플릿 키 + 정적
     *  문장 + PDF/리플레이 UI + HR 복합 라벨.
     * ════════════════════════════════════════════════════════════ */
    /* 스포츠 라벨(누락분) */
    '윈드포일': 'Windfoil',
    '포뮬라 카이트': 'Formula Kite',
    /* 세션 source 줄 (속도원·포인트 수) — 소스 i18nT 템플릿 */
    '속도원: 기기 기록': 'Speed source: device record',
    '속도원: GPS 좌표 계산': 'Speed source: GPS-derived',
    ' · GPS 포인트 {n}개 전량 사용': ' · GPS points: {n} (all used)',
    ' · 편집 적용 {n}개 분석': ' · edit applied — {n} points analyzed',
    /* 풍향 다이얼 readout / 버튼 */
    '미확정 — 확정 필요': 'Unconfirmed — needs confirmation',
    '✓ 풍향 해제': '✓ Clear wind',
    '✓ 이 풍향으로 확정': '✓ Confirm this wind',
    /* 고속 구간 회전 카드 — 손실·회복·효율 */
    '손실 {loss}% · 회복 {rec} · 회전효율 {eff} score':
      'Loss {loss}% · recovery {rec} · maneuver eff {eff} score',
    /* % of target 타일 sub */
    '{t} 비교': '{t} compared',
    ' · 주행의 {p}%만 타깃 보유': ' · only {p}% of riding has target coverage',
    '비교 가능한 구간 없음': 'No comparable segment',
    /* 심박 요약 strip — 기준 라벨 + 기록률 문구 */
    '입력 최대 {n} bpm': 'entered max {n} bpm',
    '관측 최대 {n} bpm': 'observed max {n} bpm',
    '기록 포인트 {rec}개 중 심박 {hr}개 · 기준 {basis}':
      '{hr} HR samples among {rec} recorded points · basis {basis}',
    /* HR 회전 — 최대 생리 반응 복합 라벨 (택킹/자이빙 × 포트/스타보드) */
    '택킹 · 포트': 'Tacking · Port',
    '택킹 · 스타보드': 'Tacking · Starboard',
    '자이빙 · 포트': 'Gybing · Port',
    '자이빙 · 스타보드': 'Gybing · Starboard',
    /* 바이올린 분포 — 모집단 캡션 + subtitle (단일 i18nT 템플릿) */
    '{pop} 모집단 — 평균 (실선)': '{pop} population — mean (solid)',
    '{m} 분포 · {pop} 모집단 · {dir} {act} 구간 (SOG {kt} kt 이상) · 표본 P {p}개 · S {s}개':
      '{m} distribution · {pop} population · {dir} {act} segment (SOG {kt} kt or more) · n = P {p} · S {s}',
    ' · TWA = 풍향 대비 진행 각도': ' · TWA = heading angle relative to wind',
    /* 회전 요약 범례 — 세션 베스트({b} 보간) */
    '그라데이션으로 강조된 줄은 {b}입니다 — 택킹·자이빙 각 종류에서 효율 점수가 가장 높은 회전을 표시합니다.':
      'Gradient-highlighted rows are {b} — for each maneuver type (tack / gybe), the highest-efficiency maneuver is shown.',
    /* SPS 방법론 부록 (접힘) — 정적 문장 */
    '— 속도 점수 70% + 회전 효율 30% 가중.':
      '— weighted 70% speed score + 30% maneuver efficiency.',
    '— 풍상·풍하 속도를 각각 계산기 예측 대비 평가합니다.':
      '— evaluates upwind and downwind speed each against the calculator prediction.',
    '카드는 둘을 풍상·풍하 주행 시간 으로 가중 평균한 값을 씁니다.':
      'The card uses the two time-weighted by upwind / downwind riding time.',
    '— 같은 풍속·체중·스킬·장비로 리프팅 계산기가 예측한 달성 가능 풍상 VMG 대비, 실측 풍상 VMG(상위 50%) 의 비율.':
      '— the ratio of measured upwind VMG (top 50%) to the achievable upwind VMG predicted by the lift calculator for the same wind, weight, skill and gear.',
    '= 예측치의 50% 이하. 계산기 예측은 입력한 스킬 등급에 맞춘 값이라, 100점은 “세계 최고” 가 아니라 “이 조건의 물리 모델이 본 달성 가능치 도달” 을 뜻합니다.':
      '= 50% or less of the prediction. Because the prediction is tuned to your entered skill grade, 100 points means not “world best” but “reaching the achievable level the physics model sees for these conditions”.',
    '— 계산기에 아직 풍하 전용 속도 모델이 없어, 같은 조건의 풍상 보드 속도를 상대 기준으로 쓴 휴리스틱입니다. 실측 풍하 SOG(상위 50%) 가 풍상 보드 속도의 1.4배 = 100점, 1.0배 = 50점, 0.6배 = 0점. 풍상 속도처럼 정밀한 물리 예측은 아니며, v2 에서 풍하 폴라 모델로 개선 예정입니다.':
      '— the calculator has no dedicated downwind speed model yet, so this is a heuristic that uses upwind board speed in the same conditions as a relative baseline. Measured downwind SOG (top 50%) at 1.4× the upwind board speed = 100 points, 1.0× = 50, 0.6× = 0. It is not a precise physics prediction like upwind speed, and will be improved with a downwind polar model in v2.',
    '— 이 세션 회전의 효율 점수(0~100) 평균. 풍향이 신뢰도 있게 확정되면 회전 전후 VMG 의 로스·게인, 그렇지 않으면 속도 손실·회복 시간 기반입니다. 합성 점수의 회전 항은 Upwind 가 택킹 효율, Downwind 가 자이빙 효율, Overall 이 전체 회전 효율 평균이며,':
      "— the average efficiency score (0–100) of this session's maneuvers. When the wind is confidently confirmed it is based on VMG loss/gain across the maneuver, otherwise on speed loss and recovery time. In the composite score the maneuver term uses tacking efficiency for Upwind, gybing efficiency for Downwind, and the overall maneuver-efficiency average for Overall,",
    '— 같은 풍속 영역대(미풍 ≤10kt · 중풍 11–16kt · 강풍 ≥17kt) 에 저장된 다른 세션들의 평균 대비 변화입니다. 풍속 조건이 비슷한 세션끼리 비교해야 공정하기 때문입니다. 같은 풍속대에 저장된 세션이 없으면 ‘비교 데이터 부족’ 으로 표기합니다.':
      '— the change versus the average of other saved sessions in the same wind band (light ≤10kt · moderate 11–16kt · strong ≥17kt). Comparing sessions in similar wind is the only fair basis. If no session is saved in the same wind band, it is marked “insufficient comparison data”.',
    /* 풍향 추정 카드 — 수동 확정 / 채널 안내 / 리칭 경고 */
    '수동으로 확정한 풍향을 사용합니다. 아래 추정값으로 바꾸려면 “미리보기 적용” 후 다시 확정해 주세요.':
      'Using the wind direction you confirmed manually. To switch to an estimate below, tap “Apply preview” and confirm again.',
    'Lineup 캡처 (W3-A)': 'Lineup capture (W3-A)',
    '라이더가 라인업 단계에서 풍상 두 택 헤딩을 캡처하면 가용.':
      'Available once the rider captures both upwind tack headings during the lineup phase.',
    'Apple Watch standalone 앱 연결 시 가용 (Phase 2).':
      'Available when the Apple Watch standalone app is connected (Phase 2).',
    '트랙이 주로 리칭(횡주) 왕복이라 풍상·풍하 구분이 모호합니다 — 추정 정확도가 낮으니 직접 입력으로 보정하세요.':
      'The track is mostly reaching (cross-wind) back-and-forth, so upwind / downwind is ambiguous — estimate accuracy is low, so correct it with manual input.',
    '트랙이 주로 리칭(횡주) 반전이라 풍축을 가로지르는 택·자이브가 적습니다 — 회전 기하 추정의 신뢰도가 낮으니 직접 입력으로 보정해 주세요.':
      'The track is mostly reaching (cross-wind) reversals, with few tacks / gybes crossing the wind axis — maneuver-geometry estimation has low confidence, so correct it with manual input.',
    /* 폴라 · % of target 설명 (이번 세션 단독) */
    '타깃 = 이번 세션 단독 기준입니다(누적 데이터 없음) — 세션을 저장하면 다음부터 누적 베스트로 갱신됩니다. 곡선 반지름 = TWA별 속도(kt) · 파랑 실선 = 이번 세션 포트(P) · 주황 실선 = 스타보드(S) · 옅은 점선 = 개인 베스트 타깃(기준). 실선=실제 라이딩, 점선=기준. 곡선이나 점에 커서를 올리면 해당 곡선이 강조되고 값이 표시됩니다. % of target 타일은 매 순간 속도(시간가중 평균)를 같은 TWA의 타깃과 비교한 값입니다. 연한 점 빈 13개(표본 60초 미만)는 타깃을 신뢰하기 어려워 % of target 계산에서 제외했습니다.':
      'Target = this session alone (no cumulative data yet) — once you save sessions, it updates to a cumulative best from then on. Curve radius = speed per TWA (kt) · blue solid = this session Port (P) · orange solid = Starboard (S) · faint dashed = personal-best target (reference). Solid = actual riding, dashed = reference. Hover a curve or point to highlight it and show values. The % of target tile compares each moment’s speed (time-weighted average) with the target at the same TWA. The 13 faint-dot bins (under 60s samples) are excluded from the % of target calculation because their target is not reliable.',
    /* 심박 회전 분석 설명 (순항 기준) */
    '순항 기준 심박은 포일링 중이면서 회전 밖인 구간의 시간가중 평균입니다. ‘기술 중 최고’는 심박 반응 지연을 고려해 회전 종료 직후 20초까지 포함한 최고 심박, ‘순항 대비’는 그 값과 순항 기준 심박의 차이입니다. ‘완료 후 회복’은 정점 이후 순항으로 돌아갈 때의 심박 하강폭(bpm)이며 괄호는 집계 표본 수입니다 — 회전이 실제로 심박을 올렸고 다음 회전까지 관찰 시간이 충분한 경우만 셉니다. ‘차이(S−P)’ 는 같은 회전 종류에서 스타보드 택과 포트 택의 순항 대비 상승 차이로, 양수면 스타보드 쪽 심박 반응이 더 큽니다 — 심박은 참고 지표라 좋고 나쁨이 아니라 좌우 균형을 보는 수치입니다. 맨 아래 ‘종합’ 행은 모든 회전을 합산한 값입니다. 세션 회복 지수(bpm/min)는 회복 하강 속도의 평균으로, 높을수록 회전 직후 심박이 빠르게 안정돼 심혈관 회복이 빠르다는 뜻입니다. 세션이 쌓이면 이 지수의 추세로 장기 변화를 봅니다.':
      'Cruise-baseline HR is the time-weighted average of segments that are foiling but outside maneuvers. “Peak in maneuver” is the highest HR including up to 20s after the maneuver ends (to allow for HR response lag); “vs cruise” is the difference between that peak and the cruise baseline. “Post recovery” is the HR drop (bpm) returning to cruise after the peak, and the parentheses show the sample count — only maneuvers that actually raised HR with enough observation time before the next maneuver are counted. “Difference (S−P)” is the gap in cruise-relative rise between the starboard and port tack of the same maneuver type; positive means the starboard side shows a larger HR response — HR is a reference metric, so this is about left/right balance rather than good or bad. The bottom “Overall” row sums all maneuvers. The session recovery index (bpm/min) is the average HR-drop rate during recovery; higher means HR settles faster right after a maneuver, i.e. faster cardiovascular recovery. As sessions accumulate, the trend of this index shows long-term change.',
    /* PDF 미리보기 모달 UI */
    'PDF 미리보기': 'PDF preview',
    'PDF 미리보기 준비 완료': 'PDF preview ready',
    'PDF 공유 실패': 'PDF share failed',
    'PDF 보고서 미리보기': 'PDF report preview',
    '세일링 퍼포먼스 스코어 산출 방식 설명': 'How the Sailing Performance Score is computed',
    '차트와 지도를 캡쳐하고 있어요 · 최대 30초': 'Capturing charts and map · up to 30s',
    '닫기': 'Close',
    '다운로드': 'Download',
    '공유': 'Share',
    '새 탭': 'New tab',
    '쪽': ' pages',
    /* 리플레이 시간축 토글 */
    '경과': 'Elapsed',
    '실제': 'Actual',
    '재생 시간 표기 — 경과 또는 실제': 'Playback time display — elapsed or actual',

    /* ════════════════════════════════════════════════════════════
     * §423 — 영상 없음 안내 (다른 기기에서 cloud 로 불러온 세션, 영상은
     *   local only 라 이 기기에 없을 때). 리플레이 영상 패널 배너에 사용.
     *   (spec 의 §422 는 이미 '권장 풍향 자동 적용'이 점유 → §423 채택.)
     *   replay.js 가 RDI18n.T() 로 호출(토글이 리플레이 중 숨겨져 walker
     *   대신 명시 호출). 옥대표님 결정 2026-06-18 "3번 = 영상 없는 device 안내".
     * ════════════════════════════════════════════════════════════ */
    '이 기기에 영상이 없습니다': 'No video on this device',
    '다른 기기에서 업로드한 영상은 클라우드에 저장되지 않아 이 기기에 없습니다. 영상을 보시려면 같은 영상 파일을 다시 업로드해 주세요.':
      'Videos aren’t synced to the cloud, so a video uploaded on another device isn’t available here. To watch it, please re-upload the same video file.',
    '📤 영상 업로드': '📤 Upload Video',
    '영상 없이 분석만 보기': 'View analysis without video',
    '다른 기기에서 {date}에 저장한 세션입니다.': 'Saved on another device on {date}.',
    '✓ 영상이 동기화되었습니다': '✓ Video synced',
    /* 풍향 확정 안내 / 자동추정 신뢰도 경고 (compass 는 lang-aware) */
    '✓ 풍향 {deg}° ({dir}) 확정 — 택킹/자이빙·VMG·폴라에 반영되었습니다.':
      '✓ Wind {deg}° ({dir}) confirmed — applied to tack / gybe, VMG and polar.',
    '풍상 VMG — 포트 {p} · 스타보드 {s}. 작은 풍향 변화는 합산 평균보다 포트↔스타보드 균형을 주로 바꿉니다.':
      'Upwind VMG — Port {p} · Starboard {s}. Small wind shifts mostly move the Port↔Starboard balance rather than the combined average.',
    '이 세션은 풍향 자동 추정 신뢰도가 낮습니다{x} — TWA·타깃 폴라·% of target 가 부정확할 수 있으니 풍향을 직접 확인해 주세요.':
      'This session has low confidence in automatic wind estimation{x} — TWA, target polar and % of target may be inaccurate, so verify the wind direction yourself.',
    ' (추정 불가)': ' (cannot estimate)',
    /* PDF 미리보기 버튼(이모지 접두 포함 정적 HTML 대비) */
    '📄 PDF 미리보기': '📄 PDF preview',
    /* 언어 토글 — EN 모드에서 KO 버튼/그룹 라벨도 영문(옥대표님 한글 0 지시).
       KO 모드는 restoreAll 로 '한글' 원복. native-script 선호 시 이 두 줄만 제거. */
    '한글': 'Korean',
    'Language / 언어': 'Language',
    /* ---------------- 페이지 메타 / 헤더 ---------------- */
    '라이딩 통계 대시보드 — GPX 분석 (Phase 1)':
      'Riding Stats Dashboard — GPX Analysis (Phase 1)',
    '윙포일·세일링 GPX 트랙 분석 — 속도·택킹/자이빙 효율·VMG·TWA 폴라. 코치 등급 분석.':
      'Wingfoil / sailing GPX track analysis — speed, tacking & gybing efficiency, VMG, TWA polar. Coach-grade analysis.',

    /* ---------------- 인트로 화면 ---------------- */
    'GPX 파일 하나로 라이딩을 분석합니다':
      'Analyze your riding from a single GPX file',
    '택킹·자이빙 효율, VMG, TWA 폴라':
      'tacking & gybing efficiency, VMG, TWA polar',
    '1. 스포츠 선택': '1. Choose your sport',
    '스포츠 종류': 'Sport',
    '2. GPX · VKX 파일 업로드': '2. Upload GPX or VKX file',
    'GPX 또는 VKX 파일을 끌어다 놓거나 선택':
      'Drop a GPX or VKX file here, or click to select',
    'GPX 또는 VKX 파일을 여기에 끌어다 놓으세요':
      'Drop your GPX or VKX file here',
    '또는 클릭해서 파일 선택 · .gpx · .vkx (Vakaros Atlas 2)':
      'Or click to select · .gpx · .vkx (Vakaros Atlas 2)',
    '샘플 데이터로 둘러보기 →': 'Browse with sample data →',
    '처음이라면 샘플로 먼저 살펴보세요':
      'New here? Try the sample first',
    '워치·앱에서 GPX 파일 내보내는 법':
      'How to export GPX from your watch / app',
    '분석은 모두 브라우저 안에서 처리되며, 파일은 어디에도 업로드되지 않습니다.':
      'All analysis runs in your browser — files are never uploaded.',
    '속도 시계열·분포·2초/10초/500m/1해리 베스트·고속 구간':
      'Speed time series · distribution · 2s/10s/500m/1NM bests · high-speed runs',
    '택킹·자이빙 자동 감지 + 진입/최저/탈출 속도·손실·회복':
      'Auto-detected tacks / gybes with entry / min / exit speed, loss & recovery',
    '코치 분석': 'Coach Analysis',
    'VMG·TWA 폴라·풍향 추정 — 풍향만 입력하면 열립니다':
      'VMG · TWA polar · wind estimation — unlocks once you set the wind',

    /* ---------------- 세션 헤더 ---------------- */
    '세션 제목 — 클릭하면 편집합니다':
      'Session title — click to edit',
    '클릭하면 세션 제목을 편집합니다':
      'Click to edit the session title',
    '라이딩 세션': 'Riding session',
    '세션 제목 편집': 'Edit session title',
    '세션 제목 입력': 'Session title',
    '편집본': 'Edited',
    '스포츠:': 'Sport:',
    '새 파일': 'New file',
    '이 세션 저장': 'Save session',

    /* ---------------- PDF 보고서 (Danny 2026-05-26) ---------------- */
    '📄 PDF 보고서': '📄 PDF Report',
    '📤 PDF 공유': '📤 Share PDF',
    'PDF 보고서 다운로드': 'Download PDF report',
    'PDF 보고서 공유': 'Share PDF report',
    '생성 중…': 'Generating…',
    'PDF 보고서 생성 중…': 'Generating PDF report…',
    'PDF 다운로드 완료': 'PDF downloaded',
    'PDF 공유 완료': 'PDF shared',
    'PDF 공유 취소': 'PDF share canceled',
    'PDF 생성 실패': 'PDF generation failed',
    'PDF 보고서는 세션이 로드되었을 때만 생성할 수 있습니다':
      'A session must be loaded to generate a PDF report',
    '라이딩 분석 보고서': 'Riding Analysis Report',
    '단무지 라이딩 분석 보고서': 'DMJ Gongbang Riding Analysis Report',
    '윙포일·세일링 GPX 트랙 분석': 'Wingfoil / sailing GPX track analysis',
    '단무지': 'DMJ Gongbang',
    '세션': 'Session',
    '일자': 'Date',
    '스포츠': 'Sport',
    '데이터': 'Data',
    '풍향·풍속': 'Wind dir · speed',
    '라이더 · 장비': 'Rider · Gear',
    '생성 시각': 'Generated',
    '이 보고서는 단무지 라이딩 분석 대시보드로 생성되었습니다':
      'Report generated by the DMJ Gongbang Riding Analysis Dashboard',
    '{n}쪽': 'p.{n}',
    '세션 요약': 'Session Summary',
    '풍상': 'Upwind',
    '종합': 'Overall',
    '풍하': 'Downwind',
    '세션 통계': 'Session Stats',
    '퍼포먼스 통계': 'Performance Stats',
    '지표': 'Metric',
    '값': 'Value',
    'GPS 트랙': 'GPS Track',
    '색상 = 속도(빨강 느림·초록 빠름) · 마커 = 택킹/자이빙':
      'Color = speed (red slow · green fast) · markers = tacks/gybes',
    '지도 캡쳐를 사용할 수 없습니다 (CORS 제한). 대시보드에서 확인하세요.':
      'Map capture unavailable (CORS). Please view on the dashboard.',
    '풍향 설정': 'Wind setting',
    '풍향 미설정': 'Wind not set',
    '속도 분석': 'Speed Analysis',
    '속도 시계열': 'Speed time series',
    '세션 전체 속도 · 색상은 속도 구간을 반영':
      'Full-session speed · colored by speed range',
    '속도 분포': 'Speed distribution',
    '속도 구간별 체류 시간 비율': 'Time-share by speed range',
    '차트 데이터 없음': 'No chart data',
    '고속 구간 (Run)': 'High-speed Runs',
    '회전 분석': 'Maneuver Analysis',
    '택킹 / 자이빙 요약': 'Tacks / Gybes summary',
    '폴라 다이어그램': 'Polar diagram',
    '이번 세션 포트·스타보드(실선) + 개인 베스트 타깃(점선)':
      'This session Port·Starboard (solid) + Personal best target (dashed)',
    '택 분포 — 포트 · 스타보드': 'Tack distribution — Port · Starboard',
    '가운데 축 기준 좌 = 포트(P) · 우 = 스타보드(S)':
      'Center axis: left = Port (P) · right = Starboard (S)',
    '심박 분석': 'Heart Rate Analysis',
    '세션 중 심박 추이': 'In-session HR trend',
    '배경 띠 = 심박 존': 'Background bands = HR zones',
    '심박 존 분포': 'HR zone distribution',
    '각 심박 존에 머문 시간': 'Time spent in each HR zone',
    '퍼포먼스 대비 심박 효율': 'HR efficiency vs performance',
    '같은 속도를 더 낮은 심박으로 — 유산소 효율':
      'Same speed at lower HR — aerobic efficiency',
    'Coach Danny 코멘트': 'Coach Danny Comments',
    'Coach Danny 코멘트가 아직 생성되지 않았습니다 (풍향을 확정하면 활성화됩니다)':
      'Coach Danny comments not yet generated (activates after wind is confirmed)',
    'What-if 윙 추천': 'What-if Wing Recommendation',
    '윙 사이즈 추천': 'Wing size recommendation',
    'VMG 기반 윙 사이즈 추천은 풍향·풍속·라이더 입력이 모두 확정되면 활성화됩니다.':
      'VMG-based wing size recommendation activates when wind direction, speed and rider inputs are all set.',
    '대시보드의 라이더·장비 카드와 풍향 설정 카드를 확인해 주세요.':
      'Please check the Rider · Gear card and Wind Setting card on the dashboard.',
    '부록 · 방법론': 'Appendix · Methodology',
    '알고리즘 방법론': 'Algorithm methodology',
    '속도·VMG·TWA·택킹/자이빙 자동 감지는 GPX trkpt 의 시각·좌표 데이터를 Haversine 거리·시간 차분으로 계산합니다. 풍향은 (1) 사용자 입력 (2) no-go 구간 추정 (3) 회전 기하 추정 (4) 외부 기상 데이터 중 사용자가 확정한 소스를 기준으로 사용합니다.':
      'Speed, VMG, TWA and tack/gybe auto-detection compute from GPX trkpt time/coordinate data via Haversine distance and time differentials. Wind direction uses one of: (1) manual input, (2) no-go segment estimation, (3) turn geometry estimation, or (4) external weather data — whichever source the user has confirmed.',
    '데이터 소스': 'Data sources',
    'GPX 1.1 (xmlns="http://www.topografix.com/GPX/1/1") · Vakaros Atlas 2 .vkx 바이너리 포맷. 모든 분석은 브라우저 안에서 처리되며 파일은 서버로 업로드되지 않습니다.':
      'GPX 1.1 (xmlns="http://www.topografix.com/GPX/1/1") and Vakaros Atlas 2 .vkx binary format. All analysis runs in the browser — files are never uploaded to a server.',
    '점수 체계': 'Scoring system',
    '세일링 퍼포먼스 스코어(VPS)는 풍상·풍하·종합 3축으로 라이더의 스킬·장비 대비 실제 트랙 효율을 비교합니다. 절대 등급이 아니라 개인 베스트 대비 상대 점수입니다.':
      'The Sailing Performance Score (VPS) compares actual track efficiency to rider skill / gear on three axes — upwind, downwind, overall. It is a personal-best-relative score, not an absolute grade.',
    '한계': 'Limitations',
    '이 보고서는 클라이언트 사이드 자동 분석 결과입니다. 코칭은 보조 도구로 활용하시고 안전·기술 판단은 라이더 본인 또는 자격 코치의 판단을 우선해 주세요.':
      'This report is the result of automated client-side analysis. Use the coaching as a supplement — for safety and technique decisions, always rely on the rider or a qualified coach.',
    '© 단무지 / SailTech. 본 보고서는 dmjgroup.kr 라이딩 분석 대시보드로 자동 생성되었습니다.':
      '© DMJ Gongbang / SailTech. This report was auto-generated by the dmjgroup.kr Riding Analysis Dashboard.',

    /* ---------------- 섹션 헤딩 ---------------- */
    '요약': 'Summary',
    '분석 1': 'Analysis 1',
    '분석 2': 'Analysis 2',
    '분석 3': 'Analysis 3',
    '코칭': 'Coaching',
    '기록': 'History',
    '🧭 세션 요약 · 세일링 퍼포먼스 스코어':
      '🧭 Session Summary · Sailing Performance Score',
    '📊 Speed Analysis · 속도 분석':
      '📊 Speed Analysis',
    '🔄 Maneuver Analysis · 회전(택킹·자이빙) 분석':
      '🔄 Maneuver Analysis (Tacking · Gybing)',
    '❤️ Heart Rate Analysis · 심박수 분석':
      '❤️ Heart Rate Analysis',
    '💬 Coach Danny 코멘트 · 장비 코칭':
      '💬 Coach Danny · Gear Coaching',
    '📈 저장된 세션 · 시즌 흐름':
      '📈 Saved Sessions · Season Trend',

    /* ---------------- 라이더·장비 ---------------- */
    '라이더 · 장비': 'Rider · Gear',
    '세일링 퍼포먼스 스코어·Coach Danny 분석에 사용 · 이 브라우저에 저장됩니다':
      'Used by Sailing Performance Score and Coach Danny · stored in this browser',
    '체중 (kg)': 'Weight (kg)',
    '예: 75': 'e.g. 75',
    '스킬 등급': 'Skill level',
    '윙 사이즈 (m²)': 'Wing size (m²)',
    '예: 6.0': 'e.g. 6.0',
    '프론트 윙 AR (선택)': 'Front-wing AR (optional)',
    '기본 6.5': 'Default 6.5',

    /* ---------------- 풍향 설정 ---------------- */
    '풍향 설정': 'Wind direction',
    '확정하면 택킹/자이빙 분류 · VMG · 폴라가 갱신됩니다':
      'Confirming updates tack / gybe classification, VMG and polar',
    '풍향 다이얼': 'Wind dial',
    '풍향 미설정': 'Wind not set',
    '빨간 바늘 = 바람이 불어오는 방향 · 다이얼 클릭/슬라이더로 조정':
      'Red needle = where the wind is coming FROM · click the dial or use the slider',
    '풍향 (°)': 'Wind direction (°)',
    '예: 205': 'e.g. 205',
    '풍속 (선택, kt)': 'Wind speed (optional, kt)',
    '예: 18': 'e.g. 18',
    '✦ 트랙으로 추정': '✦ Estimate from track',
    '초기화': 'Reset',
    '✓ 이 풍향으로 확정': '✓ Confirm wind',

    /* ---------------- 트랙 편집 ---------------- */
    '트랙 편집': 'Track editor',
    '원본 전체': 'Full track',
    'X축 시간 표기': 'X-axis time format',
    '경과 시간': 'Elapsed',
    '실제 시간': 'Clock time',
    '원본 복원': 'Restore original',
    '⧉ 편집본 복사 저장': '⧉ Save edited copy',

    /* ---------------- 지도 ---------------- */
    'GPS 트랙': 'GPS Track',
    '색상 = 속도(빨강 느림·초록 빠름) · 마커 = 택킹/자이빙':
      'Color = speed (red slow · green fast) · markers = tacks / gybes',
    '▶ 라이딩 리플레이': '▶ Riding Replay',
    '⛶ 전체화면': '⛶ Fullscreen',
    'GPS 트랙 — 전체화면 · 지도/그래프 hover 로 위치 확인':
      'GPS Track — fullscreen · hover the map or graph to locate',
    '✕ 닫기 (ESC)': '✕ Close (ESC)',

    /* ---------------- 퍼포먼스 통계 ---------------- */
    '퍼포먼스 통계': 'Performance Stats',
    '핵심 지표의 평균 · 대표 최댓값 · 대표 최솟값':
      'Key metrics — average · representative max · representative min',
    '오늘의 세션 속도 (노트)': 'Today’s session speed (knots)',
    '구간별 베스트 속도': 'Best speed by distance / window',
    '속도 분포': 'Speed distribution',
    '속도 구간별 체류 시간 비율': 'Dwell-time share by speed band',
    '고속 구간 (Run)': 'High-Speed Runs',

    /* ---------------- Maneuver section ---------------- */
    '택킹 / 자이빙 요약': 'Tacking / Gybing Summary',
    '택킹 / 자이빙 목록': 'Tacking / Gybing List',
    '행을 누르면 지도 번호·±10초 곡선에 표시':
      'Click a row to highlight on the map and the ±10s curve',
    '회전 종류 필터': 'Maneuver type filter',
    '전체': 'All',
    '택킹': 'Tacking',
    '자이빙': 'Gybing',
    '자세히 ▾': 'Details ▾',
    '회전 상세 — ±10초 곡선': 'Maneuver Detail — ±10s curve',
    '여러 회전을 선택하면 겹쳐 그리고 평균선을 표시':
      'Select multiple maneuvers to overlay them with a mean line',
    '위 회전 목록 또는 지도에서 회전을 선택하면 정점 ±10초 곡선이 표시됩니다.\n        여러 회전을 선택하면 겹쳐 그리고 평균 곡선을 함께 보여줍니다.':
      'Select a maneuver from the list or map above to show the apex ±10s curve. Select multiple to overlay them with a mean curve.',
    '목록의 회전 모두 선택': 'Select all maneuvers in list',
    '포트 회전': 'Port maneuvers',
    '스타보드 회전': 'Starboard maneuvers',

    /* ---------------- 바이올린 ---------------- */
    '택 분포 — 포트 · 스타보드': 'Tack Distribution — Port · Starboard',
    '가운데 축 기준 좌 = 포트(P) · 우 = 스타보드(S)':
      'Left of center = Port (P) · Right = Starboard (S)',
    '풍상/풍하 선택': 'Upwind / Downwind',
    '풍상': 'Upwind',
    '풍하': 'Downwind',
    '지표 선택': 'Metric',
    '모집단 선택': 'Population',
    '상위 50%': 'Top 50%',
    '상위 20%': 'Top 20%',

    /* ---------------- 폴라 ---------------- */
    '폴라 다이어그램 · % of target': 'Polar Diagram · % of target',
    '이번 세션 포트·스타보드(실선) + 개인 베스트 타깃(점선)':
      'This session — Port · Starboard (solid) + personal-best target (dashed)',

    /* ---------------- HR section ---------------- */
    '심박수 요약': 'Heart Rate Summary',
    'GPX 트랙에 기록된 포인트별 심박수(bpm)':
      'Per-point heart rate (bpm) recorded in the GPX',
    '최대 심박수 (bpm)': 'Max heart rate (bpm)',
    '세션 중 심박 추이': 'Heart Rate Trend',
    '배경 띠 = 심박 존 · 속도 그래프·지도와 커서가 함께 움직입니다':
      'Background bands = HR zones · cursor synced with speed chart and map',
    '심박 존 분포': 'HR Zone Distribution',
    '각 심박 존에 머문 시간': 'Time spent in each HR zone',
    '퍼포먼스 대비 심박 효율': 'Performance vs HR — Aerobic Efficiency',
    '같은 속도를 더 낮은 심박으로 — 유산소 효율':
      'Same speed with lower HR — aerobic efficiency',
    '스킬–심박수 분석': 'Skill – Heart Rate Analysis',
    '택킹·자이빙의 진입 전 → 기술 중 → 완료 후 심박 반응과 회복':
      'Tacking / gybing — HR response and recovery: before entry → during → after exit',

    /* ---------------- 저장된 세션 ---------------- */
    '세션 비교': 'Session Compare',
    '전체 삭제': 'Delete all',
    '아직 저장된 세션이 없습니다. 위에서 이 세션 저장을 누르면\n        시즌별 성장 흐름과 개인 베스트가 여기에 쌓입니다.':
      'No saved sessions yet. Save a session above to build a season trend and personal-best history here.',
    '표시 지표': 'Metrics shown',
    '표시할 지표 선택': 'Choose metrics to show',
    '평균 속도': 'Avg Speed',
    '최고 속도': 'Top Speed',
    '거리': 'Distance',
    '라이딩 시간': 'Ride Time',
    '심박 회복 지수': 'HR Recovery Index',
    '차트 종류': 'Chart type',
    '선': 'Line',
    '막대': 'Bar',
    '표시할 지표를 1개 이상 선택해 주세요.':
      'Please select at least one metric to display.',
    '날짜': 'Date',
    '스포츠': 'Sport',
    '최고': 'Top',
    '평균': 'Avg',

    /* ---------------- Footer ---------------- */
    '라이딩 통계 대시보드 — Phase 1 (검증용 MVP) · GPX 클라이언트 사이드 분석':
      'Riding Stats Dashboard — Phase 1 (validation MVP) · client-side GPX analysis',
    '데이터는 브라우저에만 저장됩니다 · 단무지 / SailTech':
      'Data stays in your browser only · DMJ Workshop / SailTech',

    /* ---------------- Nav ---------------- */
    '주 메뉴': 'Main menu',
    '단무지 홈': 'DMJ Workshop home',

    /* ---------------- 공통 라벨 ---------------- */
    '포트': 'Port',
    '스타보드': 'Starboard',
    '종합': 'Overall',
    '회전효율': 'Turn Efficiency',
    '회전 효율': 'Turn Efficiency',
    '평균 회전효율': 'Avg Turn Efficiency',
    '심박수': 'Heart Rate',
    '심박': 'HR',
    '풍상 평균': 'Upwind Avg',
    '풍하 평균': 'Downwind Avg',

    /* ---------------- 표 헤더 / 셀 ---------------- */
    '포트 · 풍상': 'Port · Upwind',
    '스타보드 · 풍상': 'Starboard · Upwind',
    '포트 · 풍하': 'Port · Downwind',
    '스타보드 · 풍하': 'Starboard · Downwind',
    '세션 평균': 'Session Averages',
    '포트·스타보드 × 풍상·풍하 평균 — VMG·TWA·SOG · 구간 통계(상위 50%·20%)는 아래 퍼포먼스 통계 표':
      'Port·Starboard × Upwind·Downwind averages — VMG·TWA·SOG · tier stats (Top 50% / 20%) in the Performance Stats table below',

    /* ---------------- VPS / SPS ---------------- */
    '세일링 퍼포먼스 스코어': 'Sailing Performance Score',
    '세일링 퍼포먼스 스코어 산출 방식': 'How the Sailing Performance Score is computed',
    '속도 점수 70%': 'Speed score 70%',
    '회전 효율 30%': 'Turn efficiency 30%',
    '풍상 속도': 'Upwind speed',
    '풍하 속도': 'Downwind speed',
    'Upwind 풍상': 'Upwind',
    'Downwind 풍하': 'Downwind',
    'Overall 종합': 'Overall',
    'Tacking 택킹': 'Tacking',
    'Gybing 자이빙': 'Gybing',
    '비교 데이터 부족': 'Insufficient comparison data',
    '동일 풍속대 평균 대비': 'vs avg at same wind range',
    '점수': 'score',
    '— 동일 풍속대 세션 없음': '— no sessions at same wind range',
    '미풍 ≤10kt': 'Light ≤10kt',
    '중풍 11–16kt': 'Medium 11–16kt',
    '강풍 ≥17kt': 'Strong ≥17kt',
    '산출 불가': 'Not computable',
    '회전 데이터 없음 — 속도 항목만 반영 (회전 30% 미적용)':
      'No maneuver data — speed only (turn 30% omitted)',
    '속도 점수 산출 불가 — 계산기가 이 조건에서 풍상 주행 불가로 예측':
      'Speed score not available — calculator predicts upwind sailing is infeasible at these conditions',

    /* ---------------- 풍향 추정 / 안내 ---------------- */
    '수동 입력': 'Manual input',
    '확정': 'Confirmed',
    '사용자가 직접 지정해 확정한 풍향입니다.':
      'Wind direction confirmed by direct user input.',
    '다이얼·슬라이더로 직접 입력할 수 있습니다.':
      'Set wind direction with the dial or slider.',
    'no-go zone 추정': 'No-go zone estimate',
    '회전 기하 추정': 'Maneuver geometry estimate',
    '회전 기하': 'Maneuver geometry',
    '외부 날씨 (준비 중)': 'External weather (coming soon)',
    '신뢰도': 'Confidence',
    '높음': 'High',
    '보통': 'Medium',
    '중': 'Medium',
    '낮음': 'Low',
    /* 풍향 추정 소스 — compass 8방위 (Danny 2026-05-26 i18n fix).
       compass(deg) 가 반환하는 한국어 단어를 EN 모드에서 영문 약어로 치환.
       단독 텍스트노드일 때만 적용되므로 windSourceRow / windRecBanner 의
       값 출력은 방위어를 자체 <span> 으로 감싸 별도 텍스트노드로 두어야 함. */
    '북': 'N',
    '북동': 'NE',
    '동': 'E',
    '남동': 'SE',
    '남': 'S',
    '남서': 'SW',
    '서': 'W',
    '북서': 'NW',
    '풍향을 설정하고 “확정”하면 택킹·자이빙 분류와 VMG·폴라 분석이 활성화됩니다.':
      'Set the wind direction and tap "Confirm" to unlock tack / gybe classification and VMG / polar analysis.',
    '풍상·풍하 주행이 부족해 no-go zone 으로 추정할 수 없습니다.':
      'Not enough upwind / downwind sailing to estimate via no-go zone.',
    '세션 헤딩 분포의 빈 쐐기(세일 불가 구역) 중심으로 추정했습니다.':
      'Estimated from the empty wedge (no-go zone) in the heading distribution.',
    'OpenWeather 등 외부 날씨 데이터 연동 예정입니다 — API 키를 입력하면 세션 시각·위치의 풍향을 자동으로 불러옵니다.':
      'External weather data integration (e.g. OpenWeather) is coming — enter an API key to auto-fetch the wind direction for the session’s time and location.',
    '풍축을 가릴 만한 택·자이브가 부족해 회전 기하로 추정할 수 없습니다.':
      'Not enough tacks / gybes that cross the wind axis to estimate via maneuver geometry.',
    '택·자이브 진입/탈출 헤딩의 이등분선으로 풍축을 재구성했습니다.':
      'Reconstructed the wind axis from the bisector of tack / gybe entry / exit headings.',
    '외부 날씨 데이터에서 불러온 풍향입니다.':
      'Wind direction fetched from external weather data.',
    '수동으로 확정한 풍향을 사용합니다.': 'Using the manually confirmed wind direction.',

    /* ---------------- 코치(옥코치 ↔ Coach Danny) 카드 ----------------
       KO 노출 = 옥코치, EN 노출 = Coach Danny. coach.js 의 동적 narration
       은 양 언어 모두 자체 분기로 출력하므로 여기엔 정적 라벨만 매핑한다.
       (Danny 2026-05-26 정정 — 이전 일괄치환에서 KO 컨텍스트의 '옥코치' 가
        실수로 영어 'Coach Danny' 로 바뀐 부분은 별도 revert 패스 필요.) */
    'Coach Danny 코멘트': 'Coach Danny',
    'Coach Danny': 'Coach Danny',
    '옥코치': 'Coach Danny',
    '옥코치 코멘트': 'Coach Danny Comments',
    '옥코치 코멘트 · 장비 코칭': 'Coach Danny · Gear Coaching',
    '💬 옥코치 코멘트 · 장비 코칭': '💬 Coach Danny · Gear Coaching',
    '세일링 퍼포먼스 스코어·옥코치 분석에 사용 · 이 브라우저에 저장됩니다':
      'Used by Sailing Performance Score and Coach Danny · stored in this browser',
    '윙 사이즈는 옥코치 what-if 분석의 필수 입력입니다.':
      'Wing size is required for Coach Danny what-if analysis.',

    /* ---------------- 단위·짧은 라벨 ---------------- */
    '회': 'times',
    '점': 'score',
    '초': 'sec',
    '개': '',
    '분': 'min',
    '시간': 'h',
    '미지정': 'Unset',
    '없음': 'None',
    '있음': 'Available',

    /* ---------------- 안내문 (sentence) ---------------- */
    '시각 정보 없음': 'No time information',
    '저장된 세션을 정말 모두 삭제할까요?': 'Delete all saved sessions?',
    '편집된 트랙을 별도 세션으로 저장합니다.':
      'Save the edited track as a separate session.',
    '데이터가 부족합니다.': 'Insufficient data.',
    '풍향을 확정해 주세요.': 'Please confirm a wind direction.',
    '회전이 감지되지 않았습니다.': 'No maneuvers detected.',
    '심박 데이터가 없습니다.': 'No heart rate data.',
    '계산 중...': 'Computing…',
    '잠시만 기다려 주세요.': 'Please wait…',
    '파일을 읽는 중...': 'Reading file…',
    '분석 중...': 'Analyzing…',
    '파일 형식을 인식하지 못했습니다.':
      'Unrecognized file format.',
    '풍향을 확정하면 SOG·VMG·TWA 통계가, 심박 데이터가 있으면 심박 통계가 이 표에 표시됩니다.':
      'Confirming the wind shows SOG / VMG / TWA stats here. HR stats appear if heart rate data is present.',
    '풍향을 확정하면 SOG·VMG·TWA 통계가 이 표에 추가됩니다.':
      'Confirming the wind adds SOG / VMG / TWA stats to this table.',
    'TWA 계산에 풍향이 필요합니다.':
      'TWA calculation requires a wind direction.',
    'TWA 빈별 주행 데이터가 더 필요합니다.':
      'More sailing data per TWA bin is needed.',
    '타깃 폴라를 만들 폴라 데이터가 부족합니다.':
      'Not enough polar data to build a target polar.',
    '타깃 곡선을 만들 표본이 부족합니다 — TWA 빈별 주행 데이터가 더 필요합니다.':
      'Not enough samples to build a target curve — more sailing data per TWA bin is needed.',

    /* ---------------- 차트 축 / 캡션 ---------------- */
    '경과 시간 (분:초)': 'Elapsed time (mm:ss)',
    '속도 (노트)': 'Speed (knots)',
    '속도 (kt)': 'Speed (kt)',
    '속도 (km/h)': 'Speed (km/h)',
    '시간': 'Time',
    '심박수 (bpm)': 'Heart Rate (bpm)',
    '체류 시간': 'Dwell Time',
    '기타': 'Other',

    /* ---------------- 카카오톡 채널 (Danny 2026-05-26 · DMJ GROUP /_VITZX) ---------------- */
    '카톡 상담': 'KakaoTalk Chat',
    '카톡 상담 ↗': 'KakaoTalk Chat ↗',
    '카톡 상담 가능': 'KakaoTalk chat available',
    '카톡 1:1 상담': '1:1 KakaoTalk Chat',
    '카톡 1:1 상담 — 8분 응답': '1:1 KakaoTalk Chat — 8 min response',
    '카톡 1:1 컨설팅': '1:1 KakaoTalk consulting',
    '카톡 컨설팅': 'KakaoTalk consulting',
    '카톡 채널 상담이 가장 빠릅니다.': 'KakaoTalk channel is the fastest way to reach us.',
    '카톡 채널이 가장 빠릅니다.': 'KakaoTalk channel is the fastest way to reach us.',
    '카톡 1:1 견적': '1:1 KakaoTalk quote',
    '1:1 카톡 컨설팅': '1:1 KakaoTalk consulting',

    /* ---------------- 컨트롤·작은 텍스트 ---------------- */
    '윙 사이즈는 Coach Danny what-if 분석의 필수 입력입니다.\n        풍속은 아래 풍향 설정 카드에서 입력합니다. 프론트 윙 면적 조언은 v2 범위입니다.':
      'Wing size is required for Coach Danny what-if analysis. Wind speed is entered in the Wind Direction card below. Front-wing area advice is planned for v2.',
    '양끝 핸들을 드래그해 워밍업·이동 구간을 잘라내면 남은 트랙이\n        가로 폭을 꽉 채웁니다. 그래프 위를 가로로 드래그하면 제외 구간(휴식·표류\n        등)이 만들어지고, 제외 구간을 누르면 해제됩니다. 편집은 실제 시간을 기준으로\n        하며 즉시 거리·속도·회전 분석에 반영됩니다.':
      'Drag the handles at either end to trim warm-up / travel sections — the remaining track fills the width. Drag horizontally over the chart to create an exclude zone (rest, drift, etc.); click an exclude zone to remove it. Edits are based on clock time and immediately update distance / speed / maneuver analysis.',

    /* ---------------- Garmin 등 (인트로 가이드) ---------------- */
    'Garmin Connect 웹 → 액티비티 열기 → 우측 상단 ⚙(톱니) →\n             원본 내보내기 또는 GPX 내보내기':
      'Garmin Connect (web) → open the activity → top-right ⚙ (gear) → Export original or Export GPX',
    'Apple 건강 앱에는 GPX 내보내기가 없습니다. HealthFit 또는\n             RunGap 같은 앱으로 워크아웃을 GPX/FIT 로 내보내세요.':
      'Apple Health has no GPX export. Use a third-party app like HealthFit or RunGap to export workouts as GPX / FIT.',
    'Samsung Health 에서 운동 기록 내보내기를 사용하거나, GPX 를 지원하는\n             서드파티 트래킹 앱(예: 윙포일 GPS 앱)으로 기록하세요.':
      'Use Samsung Health workout export, or a third-party GPS app that supports GPX (e.g., wingfoil GPS apps).',

    /* ---------------- 토글 ---------------- */
    '한글': '한글',     /* keep — both visible in toggle */
    'English': 'English',
    'Language': 'Language',
    '언어': 'Language',
    'Korean': 'Korean',

    /* ============================================================
     * Phase 2 — charts.js (Chart.js config + custom canvas) (Danny 2026-05-25)
     * ============================================================ */
    '시작': 'Start',
    '종료': 'End',
    '제외 ✕ 클릭 해제': 'Excluded ✕ click to clear',
    '경과 시간': 'Elapsed time',
    '속도 ({u})': 'Speed ({u})',
    '심박 기록 없음': 'No HR data',
    '회전 정점': 'Apex',
    'VMG ({dir}, {u})': 'VMG ({dir}, {u})',
    '회전율 (°/s)': 'Turn rate (°/s)',
    '회전율 크기 (°/s)': 'Turn rate magnitude (°/s)',
    'SOG ±1σ 밴드': 'SOG ±1σ band',
    '회전율 ±1σ 밴드': 'Turn rate ±1σ band',
    '평균 SOG ({u})': 'Avg SOG ({u})',
    '평균 회전율 (°/s)': 'Avg turn rate (°/s)',
    '회전 정점 기준 경과 시간 (sec)': 'Time relative to apex (s)',
    '표본 부족 ({n})': 'Insufficient samples ({n})',
    '데이터 없음': 'No data',
    '◀ 포트 (P)': '◀ Port (P)',
    '스타보드 (S) ▶': 'Starboard (S) ▶',
    '← 밀도': '← density',
    '밀도 →': 'density →',
    '체류 시간': 'Dwell time',
    ' ─ 합쳐진 구간 ─': ' ─ Merged bands ─',
    '기록 공백': 'Recording gap',
    '심박수 ({u})': 'Heart rate ({u})',
    '휴식 (Z1 미만)': 'Rest (below Z1)',
    '머문 시간 (min)': 'Time in zone (min)',
    '{n}분 (': '{n} min (',
    '순간 기록 (속도 · 심박)': 'Instant samples (speed · HR)',
    '속도 구간별 심박 중앙값': 'Median HR by speed band',
    '개인 베스트 타깃': 'Personal-best target',
    '이번 세션 · 포트(P)': 'This session · Port (P)',
    '이번 세션 · 스타보드(S)': 'This session · Starboard (S)',
    '▲ 풍상 0°': '▲ Upwind 0°',
    '▼ 풍하 180°': '▼ Downwind 180°',
    '━ 포트(P) 실측': '━ Port (P) actual',
    '스타보드(S) 실측 ━': 'Starboard (S) actual ━',
    '┈ 개인 베스트 타깃(기준)': '┈ Personal-best target (reference)',
    '반지름 = 속도 ({u})': 'Radius = speed ({u})',
    '거리 (km)': 'Distance (km)',
    '라이딩 시간 (min)': 'Ride time (min)',
    '심박 회복 지수 (bpm/min)': 'HR recovery index (bpm/min)',

    /* ============================================================
     * Phase 2 — coach.js (Coach Danny 코멘트 + 동적 narration) (Danny 2026-05-25)
     * ============================================================ */

    /* --- 스킬 등급 --- */
    '입문': 'Novice',
    '초급': 'Beginner',
    '중급': 'Intermediate',
    '상급': 'Advanced',
    '상급-선수': 'Advanced–Pro',
    '선수': 'Pro',

    /* --- 짧은 라벨 (tcSideLabel · recTxt) --- */
    '선택 회전': 'Selected maneuver',
    '미회복': 'no recovery',
    '{n}초': '{n}s',

    /* --- 룰별 narration nums --- */
    '진입 SOG 포트 {p} · 스타보드 {s} {u} · 진입 TWA 차 {d}°':
      'Entry SOG — Port {p} · Starboard {s} {u} · ΔTWA {d}°',
    '진입 SOG 포트 {p} · 스타보드 {s} {u}':
      'Entry SOG — Port {p} · Starboard {s} {u}',
    '{side} 진입 SOG 편차 ±{sd} {u} · 표본 {n}회':
      '{side} entry-SOG spread ±{sd} {u} · {n} samples',
    '속도 손실 포트 {p}% · 스타보드 {s}%':
      'Speed loss — Port {p}% · Starboard {s}%',
    '회복 시간 포트 {p} · 스타보드 {s}':
      'Recovery time — Port {p} · Starboard {s}',
    '택킹 진입→풍축 시간 평균 {dur}초 ({skill} 기준 {thr}초)':
      'Avg tack entry→wind-axis time {dur}s ({skill} threshold {thr}s)',
    '회전율 봉우리 2개 이상 {a}/{b}회':
      'Multi-peak turn rate {a}/{b}',
    '자이빙 탈출 TWA 평균 {x}° (라이더 풍하 평균 {r}°)':
      'Avg gybe exit TWA {x}° (rider downwind avg {r}°)',
    '평균 회전 효율 {eff}/100':
      'Avg turn efficiency {eff}/100',

    /* --- TURN_COACH_TEXT R1 — 진입 속도-각도 트레이드오프 --- */
    '진입 — 속도와 각도 맞바꿈': 'Entry — speed-vs-angle trade-off',
    '{fast}택이 더 빠르지만 풍상 각도를 내주고 있습니다.':
      '{fast} tack is faster, but giving up upwind angle.',
    '{fast}택으로 들어갈 때 발 스위치(토우사이드 전환) 중 윙 당기는 힘을 잃었거나, 속도를 얻으려 풍하로 살짝 베어어웨이한 것으로 보입니다. 중급~상급 초반까지 흔한 패턴입니다.':
      'On {fast} tack entry, it looks like you lost wing power during the foot-switch (toe-side transition), or bore away slightly downwind to gain speed. Common pattern from intermediate through early advanced.',
    '윙을 머리 위·보드 앞쪽으로 두고 리딩엣지를 수평으로 유지해 기류를 깨지 않은 채로 손을 바꾸면, 각도를 내주지 않고도 속도를 실어 갈 수 있습니다.':
      'Keep the wing overhead and forward, leading edge level, and switch hands without disrupting the airflow — you can carry speed without giving up angle.',

    /* --- R2a — 진입 속도 부족, 보드 힐 과다 --- */
    '진입 속도 부족 — 보드 힐 과다': 'Low entry speed — too much board heel',
    '{slow}택 진입 속도가 낮습니다.': '{slow} tack entry speed is low.',
    '{slow}택 진입 속도가 {fast}택보다 느립니다. 항적이 더 날카로운 것으로 보아, 보드 힐을 너무 깊게 줘 회전 중 속도를 잃은 것으로 보입니다.':
      '{slow} tack entry is slower than {fast}. The sharper track suggests you’re heeling the board too deep, bleeding speed through the turn.',
    '보드를 과하게 눕히지 말고 한 박자 길게, 일정한 반경으로 카빙하며 속도를 지킵니다.':
      'Don’t over-heel the board — carve one beat longer at a steady radius to preserve speed.',

    /* --- R2b — 진입 속도 부족, 윙 프로파일·시팅 --- */
    '진입 속도 부족 — 윙 프로파일·시팅': 'Low entry speed — wing profile / sheeting',
    '{slow}택 진입 속도가 {fast}택보다 느립니다. 항적은 매끄러운데 속도가 빨리 빠지는 것으로 보아, 윙 프로파일 문제(리치 펄럭임·스톨링)이거나 오버시팅으로 보입니다.':
      '{slow} tack entry is slower than {fast}. The track is smooth but speed drops fast — likely a wing profile issue (leech flutter / stall) or over-sheeting.',
    '윙을 과하게 당기지 말고 리치가 펄럭이지 않는 시팅을 찾아, 회전 내내 깨끗한 기류를 유지합니다.':
      'Don’t over-sheet — find a sheeting where the leech doesn’t flutter, keeping clean airflow through the entire turn.',

    /* --- R3 — 진입 일관성 부족 --- */
    '진입 일관성 부족': 'Inconsistent entry',
    '{side} 진입 속도가 회전마다 들쭉날쭉합니다.':
      '{side} entry speed varies maneuver to maneuver.',
    '{side} 진입 속도가 회전마다 편차 ±{sd} {unit} 로 들쭉날쭉합니다. 같은 바람·해상 조건이라면, 반복 경험이 부족해 매번 같은 진입 지점을 못 찾는 것으로 보입니다.':
      '{side} entry speed varies ±{sd} {unit} between maneuvers. With consistent wind and sea state, this suggests insufficient repetition — you’re not finding the same entry point each time.',
    '같은 조건에서 같은 진입 동작을 반복하며 가장 잘 되는 지점을 몸에 익히면 분산이 줄어듭니다.':
      'Repeat the same entry motion under the same conditions until your body locks onto the best point — the variance will shrink.',

    /* --- R4 — 회전 속도 손실 --- */
    '회전 속도 손실': 'Speed loss through the turn',
    '{side} 회전에서 속도 손실이 큽니다.':
      '{side} turn loses too much speed.',
    '{side} 회전에서 속도 손실이 더 큽니다(평균 {loss}%). 손·발 바꾸기가 늦었거나, 손은 바꿨지만 윙을 바람 받게 빨리 당기지 못했거나, 보드 힐을 새 풍상쪽으로 빨리 주지 못해 아래쪽 리프팅을 제때 만들지 못한 것으로 보입니다.':
      '{side} turn shows greater speed loss (avg {loss}%). Hand/foot switch was late, the wing wasn’t powered up fast enough after the switch, or board heel toward the new upwind side wasn’t delivered in time to maintain foil lift.',
    '손·발 바꾸기를 지체 없이 끝내고, 바꾼 즉시 윙을 당겨 바람을 받게 하며, 보드 힐을 새 풍상쪽으로 곧장 줘 회전 중에도 리프팅이 끊기지 않게 합니다.':
      'Complete the hand/foot switch without delay, sheet in immediately to power the wing, and heel the board to the new upwind side at once — keep foil lift unbroken through the turn.',

    /* --- R5 — 회전 후 회복 지연 --- */
    '회전 후 회복 지연': 'Slow post-turn recovery',
    '{side} 회전 후 활주 복귀가 느립니다.':
      '{side} turn — slow return to planing speed.',
    '{side} 회전 후 활주 속도로 복귀가 느립니다. 발을 바꾼 뒤 보드 힐을 풍상쪽으로 주지 않으면 보드가 가라앉는데, 아래쪽 리프팅이 확보돼야 윙을 당겨 탈출할 수 있습니다.':
      '{side} turn is slow to return to planing. After switching feet, if you don’t heel the board toward the upwind side, the board sinks — foil lift must be re-established before you can sheet in to exit.',
    '탈출 직후 보드를 풍상쪽으로 기울여 리프팅을 만들고, 속도가 살아나면 윙을 당겨 가속합니다. 속도가 죽었다면 먼저 보드를 기울여 리프팅부터 만듭니다.':
      'Right after exit, heel the board toward the upwind side to build lift; once speed picks up, sheet in to accelerate. If speed has died, restore lift first — then power up.',

    /* --- R6 — 택킹이 느림 --- */
    '택킹이 느림': 'Tack is too slow',
    '택킹 진입에서 풍축까지가 {skill} 기준보다 오래 걸립니다.':
      'Time from tack entry to wind-axis is slower than the {skill} benchmark.',
    '택킹 진입부터 풍축(정풍상) 도달까지 평균 {dur}초로, {skill} 기준 {thr}초보다 느립니다. 레벨 기준 시간은 회전 전체가 아니라 풍축까지 끌고 가는 전반부 구간을 가리킵니다 — 이 구간에서 추진력을 잃고 멈칫하는 것으로 보입니다. 풍축 이후 탈출·재정비 구간은 별도 회복 지표로 봅니다.':
      'Average time from tack entry to head-to-wind (true upwind) is {dur}s, slower than the {skill} threshold of {thr}s. The benchmark covers only the first half (carrying through to wind axis) — it looks like momentum is lost and the turn stalls there. Post-axis exit / re-set is tracked by recovery metrics separately.',
    '진입 속도를 충분히 싣고, 윙을 머리 위·앞쪽에 둔 채 망설임 없이 한 번에 손을 바꿔 풍축을 빠르게 넘깁니다.':
      'Carry enough entry speed, keep the wing overhead and forward, and switch hands in one decisive motion to cross the wind axis quickly.',

    /* --- R7 — 2단으로 끊기는 회전 --- */
    '2단으로 끊기는 회전': 'Two-step turn',
    '회전이 한 박자로 이어지지 않고 둘로 끊깁니다.':
      'The turn breaks into two motions instead of one continuous beat.',
    '회전율 봉우리가 둘 이상으로, 회전이 한 번의 리듬으로 이어지지 않고 두 동작으로 끊깁니다 — 발교차와 손교차의 시간차가 큰 것으로 보입니다.':
      'Turn rate shows two or more peaks — the turn doesn’t flow as one rhythm and breaks into two motions, suggesting too much delay between hand-switch and foot-switch.',
    '손교차를 먼저 하고, 발교차를 최대한 손교차에 가까운 타이밍으로 붙여 한 박자에 끝냅니다.':
      'Switch hands first, then bring the foot-switch as close to the hand-switch as possible — finish the whole turn in one beat.',

    /* --- R8 — 자이빙 탈출 각도 과깊음 --- */
    '자이빙 탈출 각도 과깊음': 'Gybe exit angle too deep',
    '자이빙이 너무 깊게 풍하로 빠져나옵니다.':
      'Gybe is exiting too deep downwind.',
    '자이빙 탈출 시 보드를 필요 이상으로 깊게 풍하로 떨궈, 정풍하에 가까운 느린 코스로 빠져나온 것으로 보입니다 — VMG 손실이 큽니다.':
      'On gybe exit, the board is dropped deeper downwind than needed, coming out near dead downwind — a slow course with significant VMG loss.',
    '회전을 목표 코스각(브로드 리치)에서 멈춰 세우고, 그 각에서 보드를 평평하게 눌러 가속으로 전환합니다.':
      'Stop the turn at the target course angle (broad reach), then flatten the board at that angle and switch into acceleration.',

    /* --- R9 — 회전 기술 양호 --- */
    '회전 기술 양호': 'Turn technique is solid',
    '포트·스타보드 회전이 고르고 효율이 높습니다.':
      'Port and starboard turns are even and high-efficiency.',
    '포트·스타보드 회전이 고르고 효율이 높습니다(평균 {eff}/100). 현재 회전 기술이 안정적입니다.':
      'Port and starboard turns are even and high-efficiency (avg {eff}/100). Your turning technique is stable.',

    /* --- coach.js guard / VPS notes / missing 항목 --- */
    '풍속': 'Wind speed',
    '체중': 'Weight',
    '윙 사이즈': 'Wing size',
    '풍향(확정)': 'Wind direction (confirmed)',
    '실측 풍상 VMG(풍향 확정 필요)': 'Measured upwind VMG (requires confirmed wind)',
    '리프팅 계산기 모듈': 'Lift calculator module',
    '풍향을 입력하면 포트·스타보드 비교 코칭이 가능합니다.':
      'Set the wind direction to enable port vs starboard comparison coaching.',
    '한쪽 택만 선택돼 포트·스타보드 비대칭 코칭은 생략했습니다.':
      'Only one tack is selected — port vs starboard asymmetry coaching is skipped.',
    '속도 점수 산출 불가 — 계산기가 이 조건에서 풍상 주행 불가로 예측':
      'Speed score not available — the calculator predicts upwind sailing is infeasible at these conditions',
    '회전 데이터 없음 — 속도 항목만 반영 (회전 30% 미적용)':
      'No maneuver data — speed only (turn 30% omitted)',

    /* ============================================================
     * Phase 2-C — app.js 정적 라벨 (DOM 자동 번역 대상) (Danny 2026-05-25)
     * ============================================================ */
    /* --- 스포츠 --- */
    '윙포일': 'Wingfoil',
    '윈드서핑': 'Windsurfing',
    '윈드포일': 'Windfoil',
    '포뮬라 카이트': 'Formula Kite',
    '카이트': 'Kite',

    /* --- 짧은 라벨 --- */
    '회전': 'Turn',
    '회전수': 'Maneuvers',
    '종류': 'Type',
    '구분': 'Side',
    '시각': 'Time',
    '진입': 'Entry',
    '최저': 'Min',
    '탈출': 'Exit',
    '진입 SOG': 'Entry SOG',
    '최저 SOG': 'Min SOG',
    '탈출 SOG': 'Exit SOG',
    '속도 손실': 'Speed loss',
    '총 회전각': 'Total turn angle',
    '평균 회전율': 'Avg turn rate',
    '소요 시간': 'Duration',
    '회복 시간': 'Recovery time',
    '날짜 정보 없음': 'No date',
    '미입력': 'Not entered',
    '확정됨': 'Confirmed',
    '미확정 — 확정 필요': 'Unconfirmed — please confirm',
    '✓ 풍향 해제': '✓ Clear wind',
    '풍향이 해제되었습니다.': 'Wind direction cleared.',
    '느림': 'Slow',
    '빠름': 'Fast',
    '실제 시각': 'Clock time',
    '진단': 'Diagnosis',
    '조언': 'Advice',
    '높을수록 좋음': 'Higher is better',
    '낮을수록 좋음': 'Lower is better',
    '중립 지표': 'Neutral metric',
    '중립 · 최적각 ≈140–150°': 'Neutral · optimum ≈140–150°',
    '중립 · 좌우 트림': 'Neutral · lateral trim',
    '중립 · 앞뒤 트림': 'Neutral · fore-aft trim',
    '중립 · 신체 부하 참고': 'Neutral · physical-load reference',
    '시각 정보 없음': 'No time information',
    '시각 정보가 없어 속도 그래프를 표시할 수 없습니다.':
      'No time information — speed chart unavailable.',
    '시각 정보가 없어 표준 지표를 계산할 수 없습니다.':
      'No time information — standard metrics unavailable.',
    '시각 정보가 없어 퍼포먼스 통계를 계산할 수 없습니다.':
      'No time information — performance stats unavailable.',
    '시각 정보가 없어 회전 분석 불가': 'No time information — maneuver analysis unavailable',
    '검출된 고속 구간이 없습니다.': 'No high-speed runs detected.',
    '평균 · 최고': 'avg · top',
    '힐(Heel)': 'Heel',
    '피치(Pitch)': 'Pitch',

    /* --- 요약 스트립 라벨 --- */
    '총 거리 (km)': 'Total distance (km)',
    '이동 시간 (min:sec)': 'Ride time (min:sec)',
    '최고 속도 (kt)': 'Top speed (kt)',
    '최고 속도 (km/h)': 'Top speed (km/h)',
    '평균 속도 (kt)': 'Avg speed (kt)',
    '평균 속도 (km/h)': 'Avg speed (km/h)',
    '포일링 시간 (min:sec)': 'Foiling time (min:sec)',
    '플레이닝 시간 (min:sec)': 'Planing time (min:sec)',
    '풍향 (°)': 'Wind direction (°)',
    '풍향 ': 'Wind direction ',
    '2초 구간 최고': '2-second peak',
    '이동 중': 'while moving',

    /* --- 풍향 안내 --- */
    '풍상/풍하 주행과 택·자이브가 모두 부족해 풍향을 추정할 수 없습니다. 리칭(횡주) 위주이거나 직진 구간이 적은 세션입니다 — 직접 설정해 주세요.':
      'Not enough upwind / downwind sailing and tacks / gybes to estimate the wind direction. The session is mostly reaching or has few straight runs — please set the wind manually.',
    '풍향 추정 소스': 'Wind direction sources',
    '여러 방식의 추정을 비교해 적용하세요': 'Compare different estimation methods and apply',
    '현재 적용': 'Currently applied',
    '권장': 'Recommended',
    '미리보기 적용': 'Apply preview',
    '권장값 적용': 'Apply recommended',
    '아래 추정값으로 바꾸려면 “미리보기 적용” 후 다시 확정해 주세요.':
      'To switch to one of the estimates below, tap "Apply preview" then re-confirm.',
    '자동 추정에 쓸 풍상·풍하 주행이나 택·자이브가 부족합니다 — 다이얼·슬라이더로 직접 입력해 주세요.':
      'Not enough upwind / downwind sailing or tacks / gybes for auto-estimation — please set the wind manually via the dial or slider.',

    /* --- 회전 코칭 footnote / 안내 --- */
    '회전효율 점수 0–100점 척도 · 평균 회전효율·손실의 ± 는 표준편차(±1σ) · 상위 n% 는 회전효율 높은 회전 순 평균':
      'Turn efficiency on 0–100 scale · ± after averages is standard deviation (±1σ) · top n% = mean of the highest-efficiency maneuvers',
    '택킹과 자이빙은 풍축 통과 감속이 달라 회전효율을 합산하지 않고 유형별로 나눠 봅니다.':
      'Tacking and gybing have different deceleration through the wind axis, so turn efficiency is shown per type rather than summed.',
    '회전효율 — 택킹 · 자이빙 따로': 'Turn efficiency — Tacking · Gybing separately',
    '택킹·자이빙 기술 — 포트 / 스타보드별': 'Tack / Gybe technique — by Port / Starboard',
    '평균 속도 손실': 'Avg speed loss',
    '평균 회복 시간': 'Avg recovery time',
    '평균 회전 속도': 'Avg turn rate',
    '평균 손실': 'Avg loss',
    '평균 심박': 'Avg HR',

    /* --- 회전 stats stat tiles --- */
    '전체 회전': 'Total maneuvers',
    '택킹 횟수': 'Tacks',
    '택킹 성공률': 'Tack success rate',
    '자이빙 횟수': 'Gybes',
    '자이빙 성공률': 'Gybe success rate',
    '택킹 / 자이빙': 'Tacking / Gybing',
    '풍향 필요': 'Wind required',
    '풍향 입력 시 분류': 'Classified when wind is set',
    '베스트 택킹': 'Best tack',
    '베스트 자이빙': 'Best gybe',
    '풍향을 입력하면 택킹·자이빙을 분류하고 베스트 회전을 가립니다.':
      'Set the wind to classify tacks / gybes and identify the best maneuver.',
    '검출된 택킹·자이빙이 없습니다.': 'No tacks or gybes detected.',
    '풍향을 먼저 설정하세요.': 'Please set the wind first.',
    '풍향이 확정되면 회전이 택킹·자이빙으로 분류되어, 풍축을 넘는 진짜 택킹·자이빙만 골라 여기에 표시됩니다. 위 풍향 설정 카드에서 풍향을 확정해 주세요.':
      'Once the wind is confirmed, maneuvers are classified into tacks / gybes — only those that cross the wind axis are shown here. Please confirm the wind direction in the card above.',
    '해당 종류의 회전이 없습니다.': 'No maneuvers of this type.',
    '접기 ▴': 'Collapse ▴',
    '자세히 ▾': 'Details ▾',
    '그라데이션으로 강조된 줄은 세션 베스트 회전입니다 — 택킹·자이빙 각 종류에서 효율 점수가 가장 높은 회전을 표시합니다.':
      'Gradient-highlighted rows are session-best maneuvers — the highest-efficiency tack and gybe.',
    '스타보드(S)': 'Starboard (S)',
    '포트(P)': 'Port (P)',
    '포트 → 스타보드 (P→S)': 'Port → Starboard (P→S)',
    '스타보드 → 포트 (S→P)': 'Starboard → Port (S→P)',
    '✓ 속도 손실이 거의 없는 깔끔한 회전입니다.': '✓ Clean maneuver with almost no speed loss.',

    /* --- 회전 detail 추가 --- */
    '모두 선택': 'Select all',
    '전체 해제': 'Clear all',
    '회 선택': ' selected',
    '좌우 = 포트 · 스타보드 · 밴드 = ±1σ': 'L/R = Port · Starboard · band = ±1σ',
    '굵은 선 = 평균 · 밴드 = ±1σ': 'Bold line = mean · band = ±1σ',
    '평균 SOG': 'Avg SOG',
    '평균 회전율 ': 'Avg turn rate ',
    'SOG ±1σ 밴드 ': 'SOG ±1σ band ',
    '회전율 ±1σ 밴드 ': 'Turn rate ±1σ band ',
    '개별 회전': 'Individual maneuvers',
    '포트 · 스타보드 비교 — 평균 ± 표준편차': 'Port · Starboard comparison — mean ± SD',
    '선택한 회전 — 평균 ± 표준편차': 'Selected maneuvers — mean ± SD',
    '각 값은 선택한 회전들의 평균 ± 표준편차(±1σ)입니다. 그래프가 밴드로 보여주는 회전 간 분산을 정확한 수치로 정리한 것입니다. 세일링 퍼포먼스 스코어는 회전 전후 VMG 의 로스·게인 기반 점수(0–100)의 평균으로, SPS 카드의 회전 항목과 같은 정의입니다.':
      'Each value is the mean ± standard deviation (±1σ) of the selected maneuvers — a numeric summary of the inter-maneuver spread that the chart shows as a band. The Sailing Performance Score is a 0–100 score derived from VMG loss / gain around each maneuver, using the same definition as the SPS card.',
    '세일링 퍼포먼스 스코어 (택킹)': 'Sailing Performance Score (Tacking)',
    '세일링 퍼포먼스 스코어 (자이빙)': 'Sailing Performance Score (Gybing)',
    '회전효율 점수': 'Turn efficiency',
    '차이 (S−P)': 'Δ (S−P)',
    '지표': 'Metric',
    '데이터 패턴 감지는 알고리즘이, 진단·조언은 코치 검토 초안입니다 — 추정·과장 없이 가설로 제시합니다.':
      'Pattern detection is algorithmic; diagnosis and advice are coach-reviewed drafts — presented as hypotheses without inflation.',

    /* --- 바이올린 --- */
    '풍향을 입력·확정하면 포트·스타보드 택별 속도 분포(바이올린)를 표시합니다.':
      'Set and confirm the wind to show port / starboard distribution (violin).',
    '입력하신 파일에 해당 데이터가 없습니다.': 'The uploaded file does not contain this data.',
    '포일링': 'Foiling',
    '플레이닝': 'Planing',

    /* --- 타깃 폴라 --- */
    '풍상 % of target': 'Upwind % of target',
    '풍하 % of target': 'Downwind % of target',
    '비교 가능한 구간 없음': 'No comparable segment',
    '타깃 = 이번 세션 단독 기준입니다(누적 데이터 없음) — 세션을 저장하면 다음부터 누적 베스트로 갱신됩니다.':
      'Target = this session only (no accumulated data) — save sessions to build a running personal-best target.',

    /* --- HR section --- */
    '평균 심박 (bpm)': 'Avg HR (bpm)',
    '최고 심박 (bpm)': 'Max HR (bpm)',
    '최저 심박 (bpm)': 'Min HR (bpm)',
    '심박 기록률 (%)': 'HR coverage (%)',
    '세션 시간가중 평균': 'Session time-weighted average',
    '세션 관측 최대': 'Session observed max',
    '세션 관측 최소': 'Session observed min',
    '순항 기준 심박 (bpm)': 'Cruise HR (bpm)',
    '최대 생리 반응 (bpm)': 'Max physiological response (bpm)',
    '포일링·회전 밖 시간가중 평균': 'Time-weighted avg outside foiling and turns',
    '세션 회복 지수 (bpm/min)': 'Session recovery index (bpm/min)',
    '분석한 회전 (times)': 'Maneuvers analyzed',
    '회복 표본 부족': 'Insufficient recovery samples',
    '풍향을 확정하면 택킹·자이빙별 심박 반응과 회복을 분석합니다.':
      'Confirm the wind to analyze tack / gybe HR response and recovery.',
    '심박이 함께 기록된 택킹·자이빙이 아직 없습니다.':
      'No tacks / gybes recorded with HR yet.',
    '분석 수': 'N analyzed',
    '진입 전': 'Pre-entry',
    '기술 중 최고': 'Peak (during)',
    '순항 대비': 'vs cruise',
    '완료 후 회복': 'Post-exit recovery',
    '주행 평균 심박': 'Sailing avg HR',
    '주행 평균 속도': 'Sailing avg speed',
    '심박 효율 지수': 'HR efficiency index',
    '심박 드리프트': 'HR drift',
    '회복 구간 아래 — 정지·표류·휴식': 'Below recovery — stop, drift, rest',
    '휴식': 'Rest',

    /* --- HR 효율 footnote --- */
    '효율 분석에 필요한 주행 구간이 부족합니다.':
      'Not enough sailing segments for efficiency analysis.',

    /* --- 압션 토스트 / 안내 --- */
    'GPX 파일을 분석하지 못했습니다.': 'Failed to parse the GPX file.',
    'VKX 파일을 분석하지 못했습니다.': 'Failed to parse the VKX file.',
    '파일을 읽지 못했습니다.': 'Failed to read the file.',
    '편집 적용에 실패했습니다.': 'Failed to apply edits.',
    '리플레이는 시각 정보가 있는 세션에서만 가능합니다.':
      'Replay is only available for sessions with time information.',
    '리플레이 모듈을 불러오지 못했습니다.': 'Failed to load the replay module.',
    '저장에 실패했습니다.': 'Save failed.',
    '✓ 편집본을 저장된 세션으로 복사했습니다.':
      '✓ Edited copy saved as a separate session.',
    '✓ 세션을 저장했습니다.': '✓ Session saved.',
    '저장된 모든 세션을 삭제할까요?': 'Delete all saved sessions?',
    '⚠ 이 GPX 에는 시각 정보가 없어 속도·시간 분석을 할 수 없습니다. 지도와 총 거리만 표시됩니다.':
      '⚠ This GPX has no time information — speed and time analysis are unavailable. Only the map and total distance are shown.',
    '샘플 — 부산 송정 (실측 GPX)': 'Sample — Songjeong, Busan (real GPX)',
    '샘플 데이터를 불러오지 못했습니다. 직접 GPX 파일을 업로드해 주세요.':
      'Failed to load sample data. Please upload your own GPX file.',

    /* --- 풍향 / 컴퍼스 --- */
    '북': 'N', '북동': 'NE', '동': 'E', '남동': 'SE',
    '남': 'S', '남서': 'SW', '서': 'W', '북서': 'NW',
    '우선회': 'Right turn',
    '좌선회': 'Left turn',

    /* --- 요일 --- */
    '일': 'Sun', '월': 'Mon', '화': 'Tue', '수': 'Wed',
    '목': 'Thu', '금': 'Fri', '토': 'Sat',

    /* --- 폴라 footnote --- */
    '타깃 폴라를 만들 폴라 데이터가 부족합니다.':
      'Not enough polar data to build a target polar.',
    '타깃 곡선을 만들 표본이 부족합니다 — TWA 빈별 주행 데이터가 더 필요합니다.':
      'Not enough samples to build a target curve — more sailing data per TWA bin is needed.',
    '풍향을 설정하면 타깃 폴라와 % of target 가 표시됩니다 — TWA 계산에 풍향이 필요합니다.':
      'Set the wind to display target polar and % of target — TWA calculation requires a wind direction.',
    '곡선이나 점에 커서를 올리면 해당 곡선이 강조되고 값이 표시됩니다.':
      'Hover a curve or point — that curve is emphasized and its value is displayed.',
    '% of target 타일은 매 순간 속도(시간가중 평균)를 같은 TWA의 타깃과 비교한 값입니다.':
      '% of target tiles compare instantaneous speed (time-weighted average) against the target at the same TWA.',

    /* ============================================================
     * Phase 2-C 보강 — 긴 tooltip / footnote / info-panel 텍스트
     * 호버 title 속성에 들어가는 LOSS_TIP/EFF_TIP/DURATION_TIP/RECOVERY_TIP/
     * SUCCESS_TIP 와 stats info-panel 의 sog/vmg/twa/heel/pitch/hr 해설.
     * ============================================================ */
    '회전이 골 방향(풍상·풍하) 속도를 얼마나 잃었는지를 효율 점수와 같은 기준으로 나타냅니다. 풍향이 신뢰도 있게 확정된 세션은 VMG(풍상·풍하 유효속도) 기준이라 손실 % + 효율 점수 = 100 이며, 그렇지 않으면 SOG(속도)의 진입·탈출 중 빠른 쪽 대비 회전 중 최저 속도까지의 감속폭입니다.':
      'How much speed the maneuver lost relative to the goal direction (upwind/downwind), on the same scale as the efficiency score. With reliably confirmed wind, this is based on VMG (upwind/downwind effective speed) so loss % + efficiency = 100. Otherwise, it’s the SOG deceleration from the faster of entry/exit down to the minimum speed during the turn.',
    '회전효율 점수(0~100)입니다. 풍향이 신뢰도 있게 확정된 세션은 회전 전후 VMG 의 보존율(탈출 VMG ÷ 진입 VMG), 그렇지 않으면 속도 손실(65%)과 회복 시간(35%) 을 합산해 산출합니다. 높을수록 좋은 회전입니다.':
      'Turn efficiency score (0–100). With reliably confirmed wind, it’s the VMG preservation ratio across the turn (exit VMG ÷ entry VMG). Otherwise, it’s a blend of speed loss (65%) and recovery time (35%). Higher is better.',
    '소요 시간 = 회전에 걸린 시간. 진행 방향(헤딩)이 꺾이기 시작한 순간부터 회전이 끝나 헤딩이 안정될 때까지를 잰 값으로, 회전 후 속도를 되찾는 회복 시간과는 별개입니다.':
      'Duration = time taken by the maneuver — measured from when heading starts to turn until heading settles after the turn. Separate from the recovery time required to regain speed after the turn.',
    '회복 시간 = 회전 중 최저 속도 지점부터, 회전 전후의 기준 속도(진입·탈출 중 빠른 쪽)의 95% 까지 다시 가속하는 데 걸린 시간입니다. 45초 안에 회복하지 못하면 “—” 로 표시합니다.':
      'Recovery time = time from the minimum-speed point during the turn until re-accelerating back to 95% of the reference speed (faster of entry/exit). Shown as "—" if recovery does not occur within 45s.',
    '전체 시도 중 터치다운 없이 완료한 비율입니다. 회전 도중 최저 속도가 포일링 속도 임계 아래로 떨어지지 않고 포일을 유지한 채 완료한 회전을 “성공” 으로 봅니다. 트랙 편집으로 일부 구간을 제외해도, 성공률은 편집 전 세션 전체의 택·자이브를 분모로 삼습니다 — 제외한 구간에 든 실패 회전이 빠져 성공률이 부풀지 않게 하기 위함입니다.':
      'Share of attempts completed without touchdown. A maneuver counts as a "success" if the minimum speed during the turn stays above the foiling threshold and the foil is maintained. Even with track edits that exclude segments, the success rate is computed against all tacks/gybes from the full pre-edit session — so excluded failed maneuvers don’t inflate the rate.',
    'SOG = 속도(GPS 기준 실제 이동 속도). 높을수록 좋습니다. 풍상/풍하 × 포트/스타보드 택별로, 평균과 상위 50%·20%(높은 값 구간의 시간가중 평균)를 보여 줍니다 — 단일 GPS 포인트의 순간 극값(노이즈)은 쓰지 않습니다.':
      'SOG = speed over ground (GPS-derived actual travel speed). Higher is better. Shown per upwind/downwind × port/starboard tack, with the mean and Top 50% / Top 20% (time-weighted averages of the high-value bands). Single-point GPS extremes (noise) are not used.',
    'VMG = 풍상·풍하 유효속도(바람 축으로 다가가거나 멀어지는 속도). 풍상·풍하 모두 양수로 저장하므로 높을수록 좋습니다. 포트/스타보드 택별 상위 50%·20% 는 높은 값 구간의 시간가중 평균.':
      'VMG = velocity made good toward/away from the wind axis. Stored as a positive value for both upwind and downwind, so higher is better. Top 50% / Top 20% per port/starboard tack are time-weighted averages of the high-value bands.',
    'TWA = 보트 헤딩과 풍향이 이루는 각. 풍상은 작을수록 바람에 가깝게 포인팅이라 좋아 \'상위\'가 가장 좁은 각 쪽입니다. 풍하는 VMG 최적각이 약 140~150°이고 정풍하(180°)는 오히려 느려 중립으로 두고 크기가 큰(깊은) 각 쪽을 상위로 표시합니다. 포트/스타보드 택별로 나눠 좌우 포인팅 차이를 볼 수 있습니다.':
      'TWA = angle between boat heading and wind direction. Upwind: smaller is better (pointing closer to the wind), so "top" is the narrowest angle. Downwind: VMG optimum is around 140–150° and dead downwind (180°) is actually slower, so it’s treated as neutral and "top" is the deeper angle. Split by port/starboard tack to compare pointing left vs right.',
    '힐(Heel) = 보드 좌우 기울기. 택에 따라 부호가 갈리므로(한 택 −/반대 택 +) 포트·스타보드 버킷으로 나눠 부호 있는 실제 값을 보여 줍니다 — 포트(−)와 스타보드(+)의 크기가 비슷하면 좌우로 대칭되게 기운 것입니다. 평균·상위 50%/20% 는 각 버킷에서 더 크게 기운 구간의 시간가중 평균. 트림 특성이라 좋고 나쁨을 매기지 않습니다.':
      'Heel = lateral board tilt. Sign flips by tack (one tack negative, the other positive), so it’s split into port/starboard buckets and shown with signed values — when |port| ≈ |starboard|, you’re heeling symmetrically. Mean and Top 50% / Top 20% are time-weighted averages of the deeper-heel segments in each bucket. As a trim characteristic, no good/bad rating is applied.',
    '피치(Pitch·트림) = 보드 앞뒤 기울기. 포일링 중에는 대체로 뱃머리 들림(+) 한 방향이라 부호 그대로 평균합니다. 다른 지표처럼 풍상/풍하 × 포트/스타보드 버킷으로 나눠 좌우 택 차이를 함께 봅니다. 상위 50%·20% 는 뱃머리가 더 들린 구간. 트림 특성이라 좋고 나쁨을 매기지 않습니다. 자세 센서가 담긴 .vkx 에서만 표시.':
      'Pitch (trim) = fore-aft board tilt. While foiling it’s usually nose-up (+) consistently, so averaging keeps the sign. Like other metrics, split by upwind/downwind × port/starboard to compare tacks. Top 50% / Top 20% are the more-nose-up segments. As a trim characteristic, no good/bad rating. Only shown for .vkx files with attitude sensors.',
    '심박수(HR) = 센서 관측 심박. 좌우 택과 무관해 풍상/풍하로만 나눠, 위쪽 SOG 와 같은 풍상/풍하 구조로 나란히 봅니다 — 풍상·풍하에서 더 빠를 때 실제로 더 애쓰는지 비교할 수 있습니다. 평균은 시간가중, 상위 50%·20% 는 심박이 높은 구간의 시간가중 평균입니다 — 지속된 고심박 구간을 뜻하며 단일 순간 최고가 아닙니다. 신체 부하 참고 지표라 좋고 나쁨을 매기지 않습니다.':
      'Heart rate = sensor-observed HR. Independent of tack side, so it’s split only by upwind/downwind to align with the SOG split above — letting you compare whether you’re actually working harder when faster on each side. Mean is time-weighted; Top 50% / Top 20% are time-weighted averages of the high-HR bands — representing sustained high-HR segments, not a single peak. As a physical-load reference, no good/bad rating is applied.',
    '풍상·풍하 통계는 풍향 확정 후 주행 표본의 시간가중값입니다 (풍상 {up} · 풍하 {down} 기준).':
      'Upwind / downwind stats are time-weighted over riding samples after the wind is confirmed (upwind {up} · downwind {down}).',
    'SOG·VMG·TWA·힐·피치는 풍상/풍하 × 포트/스타보드 4 버킷으로 나눠 좌우 택 차이를 함께 봅니다(심박은 좌우 택과 무관해 분할하지 않고 풍상/풍하로만 나눔). 평균·상위 50%·상위 20% 세 구간을 두며, 평균은 그 방향(풍상/풍하)의 시간가중 평균, 상위 N% 는 시간가중 구간 평균(단일 GPS 포인트 노이즈 배제)입니다. \'상위\'는 지표의 좋은 방향 기준이며(SOG·VMG 높은 값, 풍상 TWA 좁은 각), 중립 지표는 크기가 큰 값 쪽입니다. 힐은 포트(−)·스타보드(+) 부호 그대로 표시합니다.':
      'SOG / VMG / TWA / Heel / Pitch are split into 4 buckets (upwind/downwind × port/starboard) to show tack differences. HR is independent of tack side, so it’s split only by upwind/downwind. Three tiers (Mean / Top 50% / Top 20%): mean is the time-weighted average for that direction; "Top N%" is the time-weighted average over the high-value band (excludes single-point GPS noise). "Top" follows each metric’s "good direction" — high values for SOG / VMG, narrow angle for upwind TWA; for neutral metrics, the deeper-magnitude side. Heel is shown with its native port (−) / starboard (+) sign.',

    /* === EN-mode comprehensive cleanup (Danny 2026-05-26) ===
       잔존 한국어 텍스트 일괄 매핑. tip 정의 · 표 안내문 · empty-state
       메시지 · what-if · 누적 통계 · HR 분석 · PDF 보고서 안내 등. */
    '배경 띠 = 심박 존 · 우측 축 = 속도 · 그래프 클릭 시 지도가 그 시점으로 이동':
      'Background bands = HR zones · right axis = speed · click the chart to jump the map to that moment',
    '배경 띠 = 심박 존 · 그래프 클릭 시 지도가 그 시점으로 이동':
      'Background bands = HR zones · click the chart to jump the map to that moment',
    'GPX 또는 VKX 파일만 지원합니다 (.gpx · .vkx). 선택한 파일:':
      'Only GPX or VKX files are supported (.gpx · .vkx). Selected file:',
    '세일링 퍼포먼스': 'Sailing Performance',
    '이동 시간': 'Ride time',
    '총 거리': 'Total distance',
    '지도와 총 거리만 표시됩니다.': 'Only the map and total distance are shown.',
    '회전이 골 방향(풍상·풍하) 속도를 얼마나 잃었는지를':
      'How much speed toward the goal direction (upwind / downwind) the turn lost,',
    '효율 점수와 같은 기준으로 나타냅니다. 풍향이 신뢰도 있게 확정된':
      'shown on the same basis as the efficiency score. Sessions with a reliably confirmed wind',
    '세션은 VMG(풍상·풍하 유효속도) 기준이라 손실 % + 효율 점수 = 100':
      'use VMG (effective upwind / downwind speed) so Loss % + Efficiency Score = 100;',
    '이며, 그렇지 않으면 SOG(속도)의 진입·탈출 중 빠른 쪽 대비':
      'otherwise, SOG (speed) measured as the deceleration from the faster of entry / exit',
    '회전 중 최저 속도까지의 감속폭입니다.': 'down to the minimum speed during the turn.',
    '회전효율 점수(0~100)입니다. 풍향이 신뢰도 있게':
      'Turn efficiency score (0~100). Sessions with a reliably',
    '확정된 세션은 회전 전후 VMG 의 보존율(탈출 VMG ÷ 진입 VMG),':
      'confirmed wind use VMG preservation (exit VMG ÷ entry VMG);',
    '그렇지 않으면 속도 손실(65%)과 회복 시간(35%) 을 합산해 산출합니다.':
      'otherwise it combines speed loss (65%) and recovery time (35%).',
    '높을수록 좋은 회전입니다.': 'Higher is a better turn.',
    '소요 시간 = 회전에 걸린 시간. 진행 방향(헤딩)이':
      'Duration = time the turn took. Measured from when heading',
    '꺾이기 시작한 순간부터 회전이 끝나 헤딩이 안정될 때까지를 잰 값으로,':
      'starts to change until the turn ends and the heading stabilizes;',
    '회전 후 속도를 되찾는 회복 시간과는 별개입니다.':
      'separate from recovery time (how long it takes to regain speed after the turn).',
    '회복 시간 = 회전 중 최저 속도 지점부터, 회전 전후의':
      'Recovery time = from the lowest-speed point during the turn back up to 95% of',
    '기준 속도(진입·탈출 중 빠른 쪽)의 95% 까지 다시 가속하는 데 걸린':
      'the reference speed (the faster of entry / exit). Marked as “—” if not recovered',
    '시간입니다. 45초 안에 회복하지 못하면 “—” 로 표시합니다.': 'within 45 seconds.',
    '전체 시도 중 터치다운 없이 완료한 비율입니다.':
      'Share of all attempts completed without a touchdown.',
    '회전 도중 최저 속도가 포일링 속도 임계 아래로 떨어지지 않고':
      'A turn is considered successful when the minimum speed during the turn',
    '포일을 유지한 채 완료한 회전을 “성공” 으로 봅니다.':
      'stays above the foiling threshold and the foil is maintained throughout.',
    '트랙 편집으로 일부 구간을 제외해도, 성공률은 편집 전 세션 전체의':
      'Even if track editing excludes some sections, the success rate is calculated over',
    '택·자이브를 분모로 삼습니다 — 제외한 구간에 든 실패 회전이 빠져':
      'the entire pre-edit session’s tacks / gybes — so excluded failed turns',
    '성공률이 부풀지 않게 하기 위함입니다.': 'don’t inflate the success rate.',
    '최고 속도 (2초)': 'Top speed (2s)',
    '10초 peak': '10s peak',
    '1 해리 (1NM)': '1 nautical mile (1NM)',
    '알파 500': 'Alpha 500',
    'SOG = 속도(GPS 기준 실제 이동 속도). 높을수록 좋습니다.':
      'SOG = speed (actual ground speed via GPS). Higher is better.',
    '풍상/풍하 × 포트/스타보드 택별로, 평균과 상위 50%·20%(높은 값':
      'Split by upwind / downwind × port / starboard tack — average plus top 50% · 20%',
    '구간의 시간가중 평균)를 보여 줍니다 — 단일 GPS 포인트의 순간':
      '(time-weighted averages of high-value segments) — single-GPS-point instantaneous',
    '극값(노이즈)은 쓰지 않습니다.': 'peaks (noise) are excluded.',
    'VMG = 풍상·풍하 유효속도(바람 축으로 다가가거나 멀어지는':
      'VMG = effective upwind / downwind speed (rate of approach or retreat',
    '속도). 풍상·풍하 모두 양수로 저장하므로 높을수록 좋습니다.':
      'along the wind axis). Both upwind and downwind are stored as positive — higher is better.',
    '포트/스타보드 택별 상위 50%·20% 는 높은 값 구간의 시간가중 평균.':
      'Per-tack top 50%·20% are time-weighted averages of high-value segments.',
    'TWA = 보트 헤딩과 풍향이 이루는 각. 풍상은 작을수록':
      'TWA = angle between boat heading and wind direction. Upwind is better when smaller',
    '풍하는 VMG 최적각이 약 140~150°이고 정풍하(180°)는 오히려 느려':
      'Downwind has an optimal VMG angle around 140–150°; dead downwind (180°) is actually slower,',
    '중립으로 두고 크기가 큰(깊은) 각 쪽을 상위로 표시합니다. 포트/':
      'so we treat it as neutral and show the larger (deeper) angle as “top.” Split by port /',
    '스타보드 택별로 나눠 좌우 포인팅 차이를 볼 수 있습니다.':
      'starboard tack to compare left / right pointing.',
    '힐(Heel) = 보드 좌우 기울기. 택에 따라 부호가 갈리므로(한 택':
      'Heel = lateral board tilt. Sign flips by tack (one tack −, the other +),',
    '−/반대 택 +) 포트·스타보드 버킷으로 나눠 부호 있는 실제 값을':
      'so we split by port / starboard bucket and show signed actual values —',
    '보여 줍니다 — 포트(−)와 스타보드(+)의 크기가 비슷하면 좌우로':
      'similar magnitudes on port (−) and starboard (+) mean a',
    '대칭되게 기운 것입니다. 평균·상위 50%/20% 는 각 버킷에서 더 크게':
      'symmetric lean left and right. Average · top 50% / 20% are time-weighted averages',
    '기운 구간의 시간가중 평균. 트림 특성이라 좋고 나쁨을 매기지 않습니다.':
      'of more-tilted segments per bucket. A trim characteristic — not rated good or bad.',
    '피치(Pitch·트림) = 보드 앞뒤 기울기. 포일링 중에는 대체로':
      'Pitch (trim) = fore-aft board tilt. While foiling, the bow is usually',
    '뱃머리 들림(+) 한 방향이라 부호 그대로 평균합니다. 다른 지표처럼':
      'lifted (+) one direction, so we average the signed values. Like other metrics,',
    '풍상/풍하 × 포트/스타보드 버킷으로 나눠 좌우 택 차이를 함께':
      'split by upwind / downwind × port / starboard buckets to also see left / right tack',
    '봅니다. 상위 50%·20% 는 뱃머리가 더 들린 구간. 트림 특성이라':
      'differences. Top 50% · 20% are segments with more lift. A trim characteristic —',
    '좋고 나쁨을 매기지 않습니다. 자세 센서가 담긴 .vkx 에서만 표시.':
      'not rated. Only shown for .vkx files with attitude sensors.',
    '심박수(HR) = 센서 관측 심박. 좌우 택과 무관해 풍상/풍하로만':
      'HR = heart rate from sensor. Independent of tack — split only by upwind / downwind',
    '나눠, 위쪽 SOG 와 같은 풍상/풍하 구조로 나란히 봅니다 — 풍상·':
      'in the same structure as SOG above, so you can compare effort between upwind /',
    '풍하에서 더 빠를 때 실제로 더 애쓰는지 비교할 수 있습니다.':
      'downwind segments when going faster.',
    '평균은 시간가중, 상위 50%·20% 는 심박이 높은 구간의 시간가중':
      'Average is time-weighted; top 50% · 20% are time-weighted averages of',
    '평균입니다 — 지속된 고심박 구간을 뜻하며 단일 순간 최고가':
      'high-HR segments — sustained high-HR sections, not single instantaneous peaks.',
    '아닙니다. 신체 부하 참고 지표라 좋고 나쁨을 매기지 않습니다.':
      'A physical-load reference metric — not rated good or bad.',
    '시각 정보가 없어 퍼포먼스': 'Performance stats unavailable',
    '통계를 계산할 수 없습니다.': 'cannot be computed — no time information.',
    '풍향을 확정하면 SOG·VMG·TWA': 'Once the wind is confirmed, SOG · VMG · TWA',
    '통계가, 심박 데이터가 있으면 심박 통계가 이 표에 표시됩니다.':
      'stats appear in this table — plus HR stats if HR data is available.',
    '지표 (단위)': 'Metric (unit)',
    '방향': 'Direction',
    '시간가중': 'time-weighted',
    '노이즈 거부': 'noise-rejected',
    '풍상·풍하 통계는 풍향 확정 후 주행 표본의 시간가중값입니다':
      'Upwind / downwind stats are time-weighted over sailing samples after the wind is confirmed',
    '기준).': 'reference).',
    'SOG·VMG·TWA·힐·피치는 풍상/풍하 × 포트/스타보드 4 버킷으로':
      'SOG · VMG · TWA · heel · pitch are split into 4 buckets of upwind / downwind × port / starboard',
    '나눠 좌우 택 차이를 함께 봅니다(심박은 좌우 택과 무관해 분할하지':
      'to also see left / right tack differences (HR is independent of tack — split only',
    '않고 풍상/풍하로만 나눔). 평균·상위 50%·상위 20% 세 구간을 두며,':
      'by upwind / downwind). Average · top 50% · top 20% are the three sections,',
    '평균은 그 방향(풍상/풍하)의 시간가중 평균, 상위 N% 는 시간가중':
      'average being time-weighted across the direction (upwind / downwind), top N% being',
    '좋은 방향 기준이며(SOG·VMG 높은 값, 풍상 TWA 좁은 각), 중립':
      'the good-direction reference for the metric (high SOG · VMG, narrow upwind TWA); neutral',
    '지표는 크기가 큰 값 쪽입니다. 힐은 포트(−)·스타보드(+) 부호':
      'metrics use the larger-magnitude side. Heel keeps the port (−) · starboard (+) sign',
    '그대로 표시합니다.': 'as-is.',
    '포트·스타보드 × 풍상·풍하 평균 —': 'Port · starboard × upwind / downwind averages —',
    'VMG·TWA·SOG · 구간 통계(상위 50%·20%)는 아래 퍼포먼스 통계 표':
      'VMG · TWA · SOG · segment stats (top 50% · 20%) shown in the Performance Stats table below',
    '풍상/풍하 주행과 택·자이브가 모두 부족해 풍향을 추정할 수 없습니다.':
      'Not enough upwind / downwind sailing and tacks / gybes to estimate the wind direction.',
    '리칭(횡주) 위주이거나 직진 구간이 적은 세션입니다 — 직접 설정해 주세요.':
      'Session is mostly reaching or has few straight runs — please set the wind manually.',
    '다이얼·슬라이더로 보정 후 “확정”을 누르세요.':
      'Adjust via the dial / slider, then tap “Confirm”.',
    '자동 추정에 쓸 풍상·풍하 주행이나': 'Not enough upwind / downwind sailing or',
    '택·자이브가 부족합니다 — 다이얼·슬라이더로 직접 입력해 주세요.':
      'tacks / gybes for auto-estimation — please set the wind manually via the dial / slider.',
    '회 성공': ' success',
    '· 세션 전체 기준': '· whole-session basis',
    '택킹과 자이빙은 풍축 통과 감속이 달라 회전효율을':
      'Tacking and gybing have different decelerations across the wind axis, so turn efficiency',
    '합산하지 않고 유형별로 나눠 봅니다.': 'is shown per type rather than summed.',
    '회전효율 점수 0–100점 척도 · 평균 회전효율·손실의 ± 는':
      'Turn efficiency on a 0–100 scale · ± after averages of efficiency / loss is',
    '표준편차(±1σ) · 상위 n% 는 회전효율 높은 회전 순 평균':
      'standard deviation (±1σ) · top n% = mean of the highest-efficiency turns',
    '진입 (': 'Entry (',
    '최저 (': 'Min (',
    '탈출 (': 'Exit (',
    '손실 (%)': 'Loss (%)',
    '소요 (sec)': 'Duration (sec)',
    '회복 (sec)': 'Recovery (sec)',
    '회전효율 (score)': 'Efficiency (score)',
    '회 중': ' of ',
    '회 표시': ' shown',
    '풍향이 확정되면 회전이 택킹·자이빙으로 분류되어, 풍축을 넘는':
      'Once the wind is confirmed, maneuvers are classified into tacks / gybes — only those',
    '진짜 택킹·자이빙만 골라 여기에 표시됩니다. 위':
      'that cross the wind axis are shown here. Please confirm the wind direction',
    '카드에서 풍향을 확정해 주세요.': 'in the card above.',
    '그라데이션으로 강조된 줄은': 'Gradient-highlighted rows are',
    '세션 베스트 회전': 'session-best turns',
    '입니다 —': '—',
    '택킹·자이빙 각 종류에서 효율 점수가 가장 높은 회전을 표시합니다.':
      'the highest-efficiency turn for each of tack and gybe.',
    '상세 — ±10초 곡선': 'Detail — ±10s curve',
    '· 좌우 = 포트 · 스타보드 · 밴드 = ±1σ': '· L / R = Port · Starboard · band = ±1σ',
    '· 굵은 선 = 평균 · 밴드 = ±1σ': '· Bold line = mean · band = ±1σ',
    '않고 오히려 가속하며 빠져나온 좋은 회전입니다. 손실은 진입·이탈 중':
      'A strong turn — accelerated through rather than losing speed. Loss is computed against',
    '더 빠른 속도(': 'the faster of entry / exit (',
    ') 기준으로 계산합니다.': ').',
    '회 — 포트': ' — Port ',
    '· 스타보드': ' · Starboard ',
    '좌우 분할 비교 (Y축 동일 스케일)': 'split comparison (same Y-axis)',
    '회 겹쳐 보기 — 개별 곡선(연한 선) + 평균(굵은 선) + ±1σ 밴드':
      'overlaid — individual curves (light) + mean (bold) + ±1σ band',
    '· 표본 1': '· n = 1',
    '각 값은 선택한 회전들의 평균 ± 표준편차(±1σ)입니다.':
      'Each value is the mean ± standard deviation (±1σ) of the selected turns.',
    '그래프가 밴드로 보여주는 회전 간 분산을 정확한 수치로 정리한 것입니다.':
      'A numeric summary of the inter-turn spread that the chart shows as a band.',
    '세일링 퍼포먼스 스코어는 회전 전후 VMG 의 로스·게인 기반 점수(0–100)의':
      'Sailing Performance Score is a 0–100 score derived from VMG loss / gain around each turn,',
    '평균으로, SPS 카드의 회전 항목과 같은 정의입니다.':
      'using the same definition as the SPS card.',
    '데이터 패턴 감지는 알고리즘이,': 'Pattern detection is algorithmic;',
    '진단·조언은 코치 검토 초안입니다 — 추정·과장 없이 가설로 제시합니다.':
      'diagnosis and advice are coach-reviewed drafts — presented as hypotheses without inflation.',
    '풍향을 입력·확정하면 포트·스타보드 택별':
      'Set and confirm the wind to show port / starboard tack',
    '속도 분포(바이올린)를 표시합니다.': 'speed distribution (violin).',
    '분포는 heel·pitch(자세) 센서 값이 담긴 파일에서만 그릴 수':
      'Distribution can only be drawn for files with heel / pitch (attitude) sensor values.',
    '있습니다. 현재 GPX 에는 GPS·심박 데이터만 들어 있습니다 — Vakaros':
      'The current GPX contains only GPS and HR data — upload a file with attitude data',
    '.vkx 처럼 자세 데이터가 포함된 파일을 올리면 이 자리에 분포가':
      '(e.g. a Vakaros .vkx) to see the distribution',
    '표시됩니다.': 'here.',
    '— 로드된 파일에 자세(heel·pitch) 데이터가':
      '— the loaded file has no attitude (heel · pitch) data',
    '없습니다.': '.',
    '구간 표본이 없습니다.': 'No segment samples available.',
    '분포는': 'Distribution',
    '중(SOG': 'in (SOG',
    'kt 이상)인 구간만 사용합니다. 해당 방향의':
      'kt or more) only. Sailing segments in this direction',
    '주행 구간이 필요합니다.': 'are required.',
    '구간 표본이 없어': 'Not enough segment samples to show',
    '분포를 표시할 수 없습니다.': 'distribution.',
    '포트 (P)': 'Port (P)',
    '스타보드 (S)': 'Starboard (S)',
    '모집단 — 평균 (실선)': ' population — mean (solid)',
    '· TWA = 풍향 대비 진행 각도': '· TWA = angle of travel vs wind direction',
    '분포 ·': 'distribution ·',
    '모집단 ·': 'population ·',
    '구간 (SOG': 'segment (SOG',
    'kt 이상) · 표본 P': 'kt or more) · n = P',
    '개 · S': ' · S',
    '풍향을 설정하면 타깃 폴라와 % of target 가 표시됩니다 —':
      'Once wind is set, target polar and % of target are shown —',
    '타깃 곡선을 만들 표본이 부족합니다 —': 'Not enough samples to build the target curve —',
    '비교': 'compared',
    '· 주행의': '· of sailing',
    '%만 타깃 보유': '% has target coverage',
    '타깃 = 저장된 세션':
      'Target = personal-best per TWA bin (sustained-speed 95th percentile) across',
    '개의 TWA별 개인 베스트(지속 속도 95퍼센타일)입니다.': 'saved sessions.',
    '타깃 = 이번 세션 단독 기준입니다(누적 데이터 없음) —':
      'Target = this session only (no accumulated data) —',
    '세션을 저장하면 다음부터 누적 베스트로 갱신됩니다.':
      'save sessions to build a running personal-best target.',
    '곡선 반지름 = TWA별 속도(': 'Radius = speed per TWA (',
    ') · 파랑 실선 = 이번 세션 포트(P) · 주황 실선 = 스타보드(S) ·':
      ') · blue solid = this session’s Port (P) · orange solid = Starboard (S) ·',
    '옅은 점선 = 개인 베스트 타깃(기준). 실선=실제 라이딩, 점선=기준.':
      'faint dashed = personal-best target (reference). Solid = actual; dashed = reference.',
    '% of target 타일은 매 순간 속도(시간가중 평균)를':
      'The % of target tile compares the time-weighted-average instantaneous speed',
    '같은 TWA의 타깃과 비교한 값입니다.': 'to the target at the same TWA.',
    '점선 빈': 'dashed bins',
    '개(표본 없음·보간 추정)': '(no samples — interpolated)',
    '연한 점 빈': 'faint-dot bins',
    '개(표본 60초 미만)': '(under 60s of samples)',
    '는 타깃을 신뢰하기 어려워 % of target 계산에서 제외했습니다.':
      'are excluded from % of target as the target is unreliable.',
    '— TWA·타깃 폴라·% of target 가 부정확할 수 있으니 풍향을':
      '— TWA / target polar / % of target may be inaccurate; please verify',
    '직접 확인해 주세요.': 'the wind direction.',
    '° 가 자동 추정값과 최대': '° differs by up to',
    '° 차이 납니다 — 풍향이 틀리면 타깃 폴라 전체가 어긋납니다.':
      '° from the auto-estimate — incorrect wind throws off the entire target polar.',
    '풍향을 확인해 주세요.': 'Please verify the wind direction.',
    ') 기준으로 TWA 를 계산했습니다.': ') was used to compute TWA.',
    '· 순항 대비': '· vs cruise',
    '회복 표본': 'recovery samples',
    '회 평균 · 클수록 빠른 회복': 'avg — higher = faster recovery',
    'bpm 하강': 'bpm drop',
    '순항 대비 bpm': 'bpm vs cruise',
    '순항 기준 심박은 포일링 중이면서 회전 밖인 구간의 시간가중 평균입니다.':
      'Cruise reference HR = time-weighted average of foiling-while-not-turning segments.',
    '‘기술 중 최고’는 심박 반응 지연을 고려해 회전 종료 직후 20초까지':
      '“Peak during technique” includes the maximum HR up to 20s after the turn ends',
    '포함한 최고 심박, ‘순항 대비’는 그 값과 순항 기준 심박의 차이입니다.':
      'to account for HR-response delay; “vs cruise” is that value minus the cruise reference HR.',
    '‘완료 후 회복’은 정점 이후 순항으로 돌아갈 때의 심박 하강폭(bpm)이며':
      '“Post-completion recovery” is the HR drop (bpm) from peak back down to cruise,',
    '괄호는 집계 표본 수입니다 — 회전이 실제로 심박을 올렸고 다음 회전까지':
      'parentheses showing sample count — only counting turns that actually raised HR',
    '관찰 시간이 충분한 경우만 셉니다. ‘차이(S−P)’ 는 같은 회전 종류에서':
      'and had enough observation time before the next turn. “Δ (S−P)” shows the',
    '스타보드 택과 포트 택의 순항 대비 상승 차이로, 양수면 스타보드 쪽':
      'starboard-vs-port difference in HR rise vs cruise for the same turn type — positive means',
    '심박 반응이 더 큽니다 — 심박은 참고 지표라 좋고 나쁨이 아니라 좌우':
      'larger HR response on starboard. HR is a reference metric — used not for good / bad,',
    '균형을 보는 수치입니다. 맨 아래 ‘종합’ 행은 모든 회전을 합산한':
      'but to gauge left / right symmetry. The bottom “Overall” row aggregates all turns.',
    '값입니다. 세션 회복 지수(bpm/min)는 회복 하강 속도의 평균으로,':
      'The session recovery index (bpm/min) averages the HR drop rate;',
    '높을수록 회전 직후 심박이 빠르게 안정돼 심혈관 회복이 빠르다는':
      'higher means HR stabilizes faster after a turn, indicating faster cardiovascular recovery.',
    '뜻입니다. 세션이 쌓이면 이 지수의 추세로 장기 변화를 봅니다.':
      'As sessions accumulate, this index’s trend reveals long-term change.',
    '입력 최대': 'entered max',
    '관측 최대': 'observed max',
    '기록 포인트': 'recorded points',
    '개 중 심박': 'HR samples among',
    '개 · 기준': '· reference',
    '입력하신 최대 심박수': 'Your entered max HR',
    'bpm 기준으로 존을 나눕니다.': 'bpm is used as the basis for HR zones.',
    '미입력 — 세션 관측 최대값': 'Not entered — using session-observed max of',
    'bpm 을 기준으로 합니다. 본인의 최대 심박수를 입력하시면 더 정확해집니다.':
      'bpm. Enter your max HR for higher accuracy.',
    '그래프 중간의 옅은 띠는 GPS 장치가 8초 넘게':
      'The faint bands in the chart mark gaps where the GPS device paused for more than 8s',
    '기록을 멈춘 시간대(또는 트랙 편집에서 제외한 구간)입니다 — 이 세션':
      '(or sections excluded by track editing) — this session has',
    '곳. ‘심박 기록률’은 기록된 포인트 중 심박이 함께':
      'such gaps. “HR coverage” is the share of recorded points that also carry HR,',
    '잡힌 비율이라, 이런 시간 공백이 있어도 100%에 가까울 수 있습니다 —':
      'so it can still be near 100% even with these gaps —',
    '둘은 서로 다른 것을 잰 값입니다.': 'they measure different things.',
    'Z1 미만': 'Below Z1',
    '심박 효율 지수 = 주행 평균 속도(': 'HR Efficiency Index = sailing avg speed (',
    ') ÷ 평균 심박(bpm) × 100 입니다. 값이 클수록 같은 심박으로 더':
      ') ÷ avg HR (bpm) × 100. Higher = faster at the same HR —',
    '빠르게 달린 것 — 유산소 효율이 좋다는 뜻이며, 세션을 거듭하며':
      'better aerobic efficiency. Watching this rise across sessions signals improving fitness.',
    '이 값이 오르면 체력이 향상되고 있는 것입니다. 아래 그래프에서': 'In the scatter below,',
    '같은 속도라도 점이 아래쪽(낮은 심박)에 모일수록 효율적입니다.':
      'points lower (lower HR at the same speed) indicate better efficiency.',
    'bpm 달라진 값입니다 —': 'bpm — ',
    '0 에 가까울수록 같은 강도를 끝까지 잘 유지하신 것입니다.':
      'closer to 0 means you held the same effort to the end.',
    '— 속도 점수 70% + 회전 효율': ' — Speed score 70% + Turn efficiency',
    '30% 가중.': '30% weighted.',
    '— 풍상·풍하 속도를 각각 계산기 예측 대비':
      ' — Upwind / downwind speeds each evaluated vs the calculator prediction.',
    '평가합니다.': '',
    '카드는 풍상 속도,': 'card shows upwind speed;',
    '카드는 풍하 속도,': 'card shows downwind speed;',
    '카드는 둘을 풍상·풍하 주행 시간': 'card weights both by upwind / downwind sailing time',
    '으로 가중 평균한 값을 씁니다.': '.',
    '— 같은 풍속·체중·스킬·장비로 리프팅 계산기가':
      ' — Ratio of measured upwind VMG (top 50%) to the lifting calculator’s predicted',
    '예측한 달성 가능 풍상 VMG 대비, 실측 풍상 VMG(상위 50%) 의 비율.':
      'achievable upwind VMG at the same wind speed · weight · skill · gear.',
    '= 예측치 도달·초과,': '= meets or exceeds the prediction;',
    '= 예측치의 50% 이하.': '= 50% or less of the prediction.',
    '계산기 예측은 입력한 스킬 등급에 맞춘 값이라, 100점은 “세계 최고” 가':
      'The calculator prediction is keyed to your input skill level — 100 means',
    '아니라 “이 조건의 물리 모델이 본 달성 가능치 도달” 을 뜻합니다.':
      '“meeting the physics model’s achievable value for these conditions,” not “world-best.”',
    '— 계산기에 아직 풍하 전용 속도 모델이 없어,':
      ' — The calculator doesn’t yet have a dedicated downwind speed model,',
    '같은 조건의 풍상 보드 속도를 상대 기준으로 쓴 휴리스틱입니다.':
      'so we use the same-condition upwind board speed as a relative reference (heuristic).',
    '실측 풍하 SOG(상위 50%) 가 풍상 보드 속도의 1.4배 = 100점,':
      'Measured downwind SOG (top 50%) at 1.4× upwind board speed = 100;',
    '1.0배 = 50점, 0.6배 = 0점. 풍상 속도처럼 정밀한 물리 예측은 아니며,':
      '1.0× = 50; 0.6× = 0. Not as precise as upwind speed prediction;',
    'v2 에서 풍하 폴라 모델로 개선 예정입니다.': 'a downwind polar model is planned for v2.',
    '— 이 세션 회전의 효율 점수(0~100) 평균.':
      ' — Average of this session’s turn efficiency scores (0~100).',
    '풍향이 신뢰도 있게 확정되면 회전 전후 VMG 의 로스·게인, 그렇지 않으면':
      'Uses VMG loss / gain around each turn if wind is reliably confirmed; otherwise',
    '속도 손실·회복 시간 기반입니다. 합성 점수의 회전 항은 Upwind 가 택킹':
      'speed loss · recovery time. The turn term in the composite score is tack efficiency for',
    '효율, Downwind 가 자이빙 효율, Overall 이 전체 회전 효율 평균이며,':
      'Upwind, gybe efficiency for Downwind, and overall turn efficiency for Overall;',
    'Tacking 택킹·Gybing 자이빙': 'the Tacking · Gybing',
    '카드로 따로 보여드립니다.': 'cards show them separately.',
    '델타(+/−)': 'Delta (+/−)',
    '— 같은 풍속 영역대(미풍 ≤10kt · 중풍 11–16kt ·':
      ' — Change vs the average of other saved sessions in the same wind band (light ≤10kt · medium 11–16kt ·',
    '강풍 ≥17kt) 에 저장된 다른 세션들의 평균 대비 변화입니다. 풍속 조건이':
      'strong ≥17kt). Same-wind-condition sessions are compared to keep it fair.',
    '비슷한 세션끼리 비교해야 공정하기 때문입니다. 같은 풍속대에 저장된':
      'If no saved session exists in the same wind band,',
    '세션이 없으면 ‘비교 데이터 부족’ 으로 표기합니다.': 'we show “Insufficient comparison data.”',
    '이 세션에 분류된': 'No',
    '이 없어 점수를 산출할 수 없습니다.':
      'were classified for this session — score cannot be computed.',
    '풍향 확정': 'Wind confirmation',
    '필요한 입력이 부족합니다': 'required inputs are missing',
    '’ 카드': '’ card',
    '세일링 퍼포먼스 스코어 (SPS)': 'Sailing Performance Score (SPS)',
    '시각 정보가 없는 GPX 라 세일링 퍼포먼스 스코어를':
      'No time information in the GPX — Sailing Performance Score',
    '산출할 수 없습니다.': 'cannot be computed.',
    '세일링 퍼포먼스 스코어를 산출하려면 다음 입력이':
      'To compute the Sailing Performance Score, the following inputs are still',
    '더 필요합니다 —': 'needed —',
    '델타는 같은 풍속 영역대(': 'Delta vs same-wind-band (',
    ') 에 저장된 다른 세션': ') saved sessions —',
    '개의 세일링 퍼포먼스 스코어 평균 대비입니다.':
      'compared to their Sailing Performance Score average.',
    '같은 풍속대 세션이 없는 항목은 ‘비교 데이터 부족’ 으로 표시합니다.':
      'Entries without same-wind-band sessions are shown as “Insufficient comparison data.”',
    '같은 풍속 영역대(': 'No other sessions saved in the same wind band (',
    '풍속 미입력': 'wind speed not entered',
    ') 에 저장된 다른 세션이 없어 델타 비교를 생략했습니다 —': ') — delta comparison omitted.',
    '같은 풍속대 세션이 쌓이면 자동으로 비교됩니다.':
      'It will be compared automatically once same-wind-band sessions accumulate.',
    '기준 — 풍속': 'Basis — wind',
    'kt · 체중': 'kt · weight',
    '· 윙': '· wing',
    'm² · 프론트 윙 AR': 'm² · front-wing AR',
    '계산기가 이 조건에서 풍상 주행 불가로 예측해 속도 점수 일부가':
      'Calculator predicts upwind sailing is infeasible at these conditions — some speed scores',
    '산출되지 않았습니다.': 'are not computed.',
    '현재 윙 값은 이번 세션': 'The current-wing value is this session’s',
    '실측 풍상 VMG': 'measured upwind VMG',
    '이고,': ', and the',
    '다른 윙 사이즈 수치는 계산기의 상대 윙-사이즈 곡선을 그 실측값에 곱해':
      'numbers for other wing sizes are estimates obtained by scaling the calculator’s relative',
    '환산한': 'wing-size curve to the measured value —',
    '입니다. 이 분석은 풍상 VMG 만 기준으로 하므로, 더 작은':
      'an estimate. This analysis is upwind-VMG-only, so smaller wings',
    '윙은 이륙·풍하에서 불리할 수 있어 세션 전체 장비는 종합적으로 판단하세요.':
      'may be worse for take-off / downwind — judge the full session gear holistically.',
    '실제 체감은 파도·체력·세팅에 따라 달라집니다.':
      'Actual feel depends on waves · fitness · setup.',
    '이번 세션 풍상 VMG 상위 20% —': 'This session’s upwind VMG top 20% —',
    '양 택 중 우세 택 기준': 'using the better of the two tacks',
    '실측값은': 'measured value is',
    'what-if 의': 'and what-if’s',
    '현재 윙 값은 이 실측값을 그대로 씁니다':
      'current-wing value uses this measured value as-is',
    '약한 택(스킬 갭)이 평균을 깎지 않도록 잘하는 쪽 택을 기준으로':
      'We use the stronger tack as the reference so the weaker (skill-gap) tack',
    '잡았습니다.': 'doesn’t drag down the average.',
    '계산기가 이번 조건(': 'The calculator could not model the current wing (',
    '바람·체중': 'wind · weight',
    ')에서 현재 윙(': ') under upwind sailing for this session (',
    ')을 풍상 주행으로 모델링하지 못해, 윙 사이즈별 비교는': '), so per-wing-size comparison is',
    '제공하지 않습니다 — 신뢰할 수 있는 값은 위 실측 풍상 VMG 뿐입니다.':
      'not provided — the only reliable value is the measured upwind VMG above.',
    '차이가': 'The difference of',
    '수준에 그쳐': 'is small,',
    '의미 있는 개선 여지가 없어': 'so there is no meaningful improvement —',
    '퍼포먼스 추천': 'Performance recommendation',
    '— 같은': ' — at the same',
    '기준으로, 계산기는 현재': 'the calculator sees the current',
    '윙이 곧 풍상 VMG 정점이라고 봅니다 —': 'wing as the upwind-VMG peak —',
    '지금 윙 선택이 적절했습니다.': 'your wing choice was right.',
    '기준으로, 풍상 VMG 정점은': 'the upwind-VMG peak is',
    '이지만 현재': 'but the difference vs the current',
    'm² 와의': 'm² is small (',
    '(추천 기준': 'recommendation threshold',
    '미만), 굳이 바꾸지 않아도 됩니다.': ') — no need to switch.',
    '더 작은': 'smaller',
    '더 큰': 'larger',
    '기준으로, 계산기는 윙을': 'the calculator estimates that switching to a',
    '로 바꿨을 때 풍상 VMG 가 가장 높을': 'wing would give the highest upwind VMG',
    '것으로 추정합니다 — 실측값을 기준으로 환산하면 약': '— scaled from the measured value, about',
    '(현재': '(current',
    'm² 실측': 'm² measured',
    '대비 +': ' vs +',
    '추정). 다음 세션에서': 'estimated). Worth trying a',
    '윙을 시도해 볼 만합니다.': 'wing next session.',
    '참고 — 정점이 분석 범위(': 'Note — the peak is at the analysis range edge (',
    'm²) 경계에 있어, 실제 정점은 이 범위 밖일 수':
      'm²), so the true peak may lie outside this range.',
    '있습니다.': '',
    '편안함 추천': 'Comfort recommendation',
    '— 참고로,': ' — for reference,',
    '가 풍상 주행이 가능한 가장 작은': 'is the smallest wing that can sail upwind,',
    '윙이라, 퍼포먼스 추천보다 더 작은 편안함용 윙은 따로 없습니다.':
      'so there is no smaller comfort wing than the performance recommendation.',
    '풍상 VMG 는 약': 'upwind VMG is about',
    '로 정점보다 다소 낮지만': ', somewhat below the peak,',
    '풍상 VMG 는 정점보다 다소 낮지만': 'upwind VMG is somewhat below the peak, but',
    '윙이 가볍고 펌핑·기동이 한결 수월합니다':
      'a smaller wing is lighter and easier to pump / maneuver',
    '— 지금 쓰시는 윙이 바로 이 편안함 추천입니다':
      '— your current wing is exactly this comfort recommendation',
    '. 빠르게 갈 땐 퍼포먼스 추천을, 길게 편히 탈 땐 이쪽을 고르세요.':
      '. Pick the performance recommendation for speed; pick this one for long, easy sessions.',
    '· 현재': '· current',
    '편안함 · 참고': 'Comfort · reference',
    '현재 윙': 'Current wing',
    '풍상 주행 불가': 'Upwind sailing infeasible',
    '현재 사용 윙 (실측)': 'Current wing (measured)',
    '퍼포먼스 추천 (VMG 정점)': 'Performance recommendation (VMG peak)',
    '편안함 추천 (참고)': 'Comfort recommendation (reference)',
    '다른 윙 추정치': 'Other wing estimates',
    'What-if · 윙 사이즈별 풍상 VMG': 'What-if · upwind VMG by wing size',
    '상위 20% · 양 택 중 우세 택 기준': 'Top 20% · stronger tack of the two',
    '현재 윙 막대는 이번 세션 풍상 VMG 상위 20%':
      'The current-wing bar is this session’s upwind VMG top 20%',
    '(양 택 중 우세 택 기준), 나머지는 계산기의 상대 윙-사이즈 곡선을 이 값에':
      '(stronger tack); the others are estimates from the calculator’s relative wing-size curve',
    '곱한 추정치입니다 (0.5 m² 간격) · 초록 채움 = 퍼포먼스 추천,':
      'scaled to this value (0.5 m² steps) · solid green = performance recommendation,',
    '초록 테두리 = 편안함 추천(참고)': 'green outline = comfort recommendation (reference)',
    '계산기 기반 장비 코칭 · 추정': 'Calculator-based gear coaching · estimated',
    '시각 정보가 없는 GPX 라 코칭을 제공할 수 없습니다.':
      'No time information in the GPX — coaching unavailable.',
    '장비 코칭을 시작하려면 다음 입력이':
      'To start gear coaching, the following inputs are still',
    '. what-if 는 실측': '. What-if uses the measured',
    '풍상 VMG 에 맞춰 산출되므로 풍향 확정이 필요합니다.':
      'upwind VMG as its anchor — wind direction must be confirmed.',
    'what-if · 추정': 'what-if · estimated',
    '선택 없음': 'None selected',
    '접기 ▴ · 최근': 'Collapse ▴ · latest',
    '개만': ' only',
    '전체보기 ▾ · 전체': 'Show all ▾ · total',
    '저장된 세션을 찾을 수 없습니다.': 'No saved sessions found.',
    '이 세션은 요약만 저장되어 다시 불러올 수 없습니다.':
      'Only the summary was saved for this session — cannot be reloaded.',
    '새로 저장하는 세션부터 다시 보기가 가능합니다.':
      'Newly saved sessions can be replayed from now on.',
    '누적 거리': 'Total distance',
    '개 세션 합계': 'session total',
    '누적 시간': 'Total time',
    '이동 시간 합계': 'ride-time total',
    '누적 횟수': 'Total count',
    '저장된 세션 수': 'saved sessions',
    '10초 Peak': '10s Peak',
    '500m 베스트': '500m best',
    '최장 거리': 'Longest distance',
    '누적 거리 ÷ 누적 시간': 'total distance ÷ total time',
    '평균 거리': 'Avg distance',
    '세션당 평균': 'per-session avg',
    '누적 합계': 'cumulative total',
    '최고 기록': 'best record',
    '타일을 누르면 그 기록을 세운 세션 분석으로 이동합니다':
      'Tap a tile to open the analysis of the session that set that record',
    '기록 지점': 'record point',
    '분석할 트랙 포인트가 부족합니다.': 'Not enough track points to analyze.',
    '타임스탬프가 있는 포인트가 부족합니다.': 'Not enough time-stamped points.',
    '분석할 트랙 구간이 없습니다.': 'No track segment available to analyze.',
    'SOG (속도)': 'SOG (speed)',
    'VMG (풍상·풍하 유효속도)': 'VMG (effective upwind / downwind speed)',
    '힐 (Heel)': 'Heel',
    '피치 (Pitch·트림)': 'Pitch (trim)',
    '심박수 (HR)': 'Heart rate (HR)',
    '뚜렷한 무항주(no-go) 구역이 없어 풍향 자동 추정이 불확실합니다 —':
      'No clear no-go zone — automatic wind estimation is uncertain —',
    '직접 입력을 권장합니다.': 'manual input recommended.',
    '트랙이 주로 리칭(횡주) 왕복이라 풍상·풍하 구분이 모호합니다 —':
      'Track is mostly reaching — upwind / downwind distinction is ambiguous —',
    '추정 정확도가 낮으니 직접 입력으로 보정하세요.':
      'estimation accuracy is low; please correct manually.',
    'no-go zone — 세션 헤딩 분포의 빈 쐐기(세일 불가 구역) 중심':
      'no-go zone — center of the empty wedge (no-sail region) in the session heading distribution',
    '트랙이 주로 리칭(횡주) 반전이라 풍축을 가로지르는 택·자이브가':
      'Track is mostly reaching reversals — tacks / gybes crossing the wind axis are',
    '적습니다 — 회전 기하 추정의 신뢰도가 낮으니 직접 입력으로':
      'scarce — maneuver-geometry estimation is unreliable; please correct',
    '보정해 주세요.': 'manually.',
    '풍축은 비교적 또렷하나 택·자이브의 속도 손실 차가 작아':
      'The wind axis is fairly clear, but the speed-loss difference between tacks / gybes is small —',
    '풍상·풍하 방향(180°) 판정이 약합니다 — 다른 소스와':
      'upwind / downwind direction (180°) is weakly determined — cross-check',
    '대조해 주세요.': 'against another source.',
    '검출된 택·자이브가 적거나 회전별 추정이 흩어져 신뢰도가':
      'Few detected tacks / gybes or scattered per-turn estimates — reliability is',
    '낮습니다 — 직접 입력으로 보정해 주세요.': 'low; please correct manually.',
    '회전 기하 — 택·자이브 진입/탈출 헤딩의 이등분선으로 풍축 재구성':
      'maneuver geometry — wind axis reconstructed from the bisector of tack / gybe entry / exit headings',
    'OpenWeather 등 외부 날씨 데이터 연동 예정입니다 — API 키를':
      'External weather data integration (e.g. OpenWeather) is coming — enter an API key',
    '입력하면 세션 시각·위치의 풍향을 자동으로 불러옵니다.':
      'to auto-fetch the wind direction for the session’s time and location.',
    '두 독립 추정이 ±': 'The two independent estimates agree within ±',
    '° 내로': '°',
    '일치하나, 두 방식 모두 신뢰도가 낮아 직접 입력 보정을 권장합니다.':
      ', but both methods have low confidence — manual input is recommended.',
    'no-go zone 과 회전 기하 추정이 ±':
      'no-go zone and maneuver-geometry estimates agree within ±',
    '° 내로 일치합니다 — 신뢰도가 높습니다.': '° — high confidence.',
    '° 내로 일치해 신뢰도를 높였습니다.': '°, so confidence was raised.',
    'no-go zone 과 회전 기하 추정이':
      'no-go zone and maneuver-geometry estimates differ by',
    '° 어긋납니다 — 두 값을 비교해 직접 확인 후 확정하세요.':
      '° — compare the two values and confirm manually.',
    '추정 소스 하나만 사용할 수 있습니다.': 'Only one estimation source is available.',
    'no-go zone 추정만 사용할 수 있습니다.': 'Only the no-go zone estimate is available.',
    '회전 기하 추정만 사용할 수 있습니다.':
      'Only the maneuver-geometry estimate is available.',
    '시각 정보가 없는 세션은 구간 편집을 할 수 없습니다.':
      'Cannot edit segments — session has no time information.',
    '선택한 구간이 너무 짧습니다.': 'Selected segment is too short.',
    '시각 정보가 없는 세션은 편집할 수 없습니다.':
      'Cannot edit — session has no time information.',
    '편집 결과 남는 구간이 너무 짧습니다.': 'Remaining segment after editing is too short.',
    '회복': 'Recovery',
    '아주 가벼운 강도 — 워밍업·휴식·능동 회복':
      'Very light intensity — warm-up · rest · active recovery',
    '유산소': 'Aerobic',
    '편하게 대화 가능한 지구성 — 지방 연소·기초 체력':
      'Conversational endurance — fat burning · base fitness',
    '템포': 'Tempo',
    '중강도 — 심폐 지구력이 늘어나는 구간':
      'Moderate intensity — cardiovascular endurance grows',
    '역치': 'Threshold',
    '젖산 역치 부근 — 길게 버티기 힘든 강도':
      'Near lactate threshold — hard to sustain for long',
    '무산소': 'Anaerobic',
    '최대에 가까운 강도 — 짧게만 지속 가능':
      'Near-maximal intensity — sustainable only briefly',
    '제외 ✕': 'Excluded ✕',
    '─ 합쳐진 구간 ─': '─ Merged segment ─',
    '속도·VMG·TWA·택킹/자이빙 자동 감지는 GPX trkpt 의 시각·좌표 데이터를':
      'Speed · VMG · TWA · auto tack/gybe detection compute from the GPX trkpt time / coordinate data',
    'Haversine 거리·시간 차분으로 계산합니다. 풍향은 (1) 사용자 입력 (2) no-go':
      'using Haversine distance and time differentials. Wind direction is sourced from one of: (1) manual input, (2) no-go',
    '구간 추정 (3) 회전 기하 추정 (4) 외부 기상 데이터 중 사용자가 확정한':
      'zone estimation, (3) maneuver-geometry estimation, or (4) external weather data —',
    '소스를 기준으로 사용합니다.': 'whichever source the user confirmed.',
    '바이너리 포맷. 모든 분석은 브라우저 안에서 처리되며 파일은 서버로':
      'binary format. All analysis runs in the browser; files are never uploaded',
    '업로드되지 않습니다.': 'to a server.',
    '세일링 퍼포먼스 스코어(VPS)는 풍상·풍하·종합 3축으로 라이더의 스킬·장비':
      'Sailing Performance Score (SPS) compares actual track efficiency on three axes — upwind, downwind, overall —',
    '대비 실제 트랙 효율을 비교합니다. 절대 등급이 아니라 개인 베스트 대비':
      'against the rider’s skill and gear. Not an absolute grade — a relative score',
    '상대 점수입니다.': 'vs the personal best.',
    '이 보고서는 클라이언트 사이드 자동 분석 결과입니다. 코칭은 보조 도구로':
      'This report is automatic client-side analysis output. Use coaching as a supporting tool;',
    '활용하시고 안전·기술 판단은 라이더 본인 또는 자격 코치의 판단을 우선해':
      'safety and technique calls should defer to the rider or a qualified coach.',
    '주세요.': '',
    '라이딩보고서-': 'Riding-report-',

    /* === final-pass standalone labels (Danny 2026-05-26) === */
    '클릭하면 지도에 이 구간 트랙이 표시됩니다': 'Click to show this segment on the map',
    '요약만 저장된 세션이라 다시 불러올 수 없습니다': 'Summary-only session — cannot be reloaded',
    '요약만': 'Summary only',
    '클릭하면 이 세션을 대시보드에 다시 불러옵니다': 'Click to reload this session on the dashboard',
    '↻ 다시 보기': '↻ Reopen',
    '삭제': 'Delete',
    '클릭하면 이 기록을 세운 세션 분석으로 이동합니다': 'Click to jump to the session that set this record',
    '요약만 저장된 세션이라 이동할 수 없습니다': 'Summary-only session — cannot navigate',
    '잘림': 'trimmed',
    '제외': 'Excluded',
    '구간': 'segment',
    '손실': 'Loss',
    '노트': 'knots',
    '— 참고로, 한 사이즈 작은': '— for reference, one size smaller',
    '풍향': 'Wind direction',
    '권장 추정값': 'Recommended estimate',
    '추정값': 'Estimate',
    '무항주 구역 폭': 'No-go zone width',
    '그리드 정렬도': 'Grid alignment',
    '추정 분산': 'Spread',
    '풍상·풍하 판정 여유': 'Upwind / downwind margin',
    '임계': 'Threshold',
    '이상': 'or higher',
    '편집됨': 'Edited',
    '분석 길이': 'analyzed length',
    '오늘의 세션 속도': 'Today’s session speed',

    /* === index.html + mobile menu cleanup (Danny 2026-05-26) === */
    '단무지 소개': 'About DMJ Gongbang',
    '라이딩 통계 대시보드': 'Riding Stats Dashboard',
    '윙포일·세일링 GPX 분석 · Phase 1': 'Wingfoil / sailing GPX analysis · Phase 1',
    '라이딩 분석 완료': 'Riding analysis complete',
    '아무 곳이나 누르면 대시보드로 이동합니다': 'Tap anywhere to open the dashboard',
    '대시보드 바로 보기 →': 'View dashboard →',
    '워치·GPS 앱에서 내보낸 트랙을 올리면 속도 분석과 함께': 'Upload a track exported from your watch / GPS app to see speed analysis together with',
    '까지 — 일반 GPS 앱이 보여주지 않는': '— coach-grade analysis that ordinary GPS apps don’t show.',
    'GPX 내보내기': 'GPX Export',
    'Apple 건강 앱에는 GPX 내보내기가 없습니다.': 'Apple Health does not have GPX export.',
    'Samsung Health 에서 운동 기록 내보내기를 사용하거나, GPX 를 지원하는\n             서드파티 트래킹 앱(예: 윙포일 GPS 앱)으로 기록하세요.': 'Use Samsung Health’s exercise-record export, or record with a third-party tracking app that supports GPX (e.g. a wingfoil GPS app).',
    'Garmin Connect 웹 → 액티비티 열기 → 우측 상단 ⚙(톱니) →': 'Garmin Connect (web) → open activity → top-right ⚙ (gear) →',
    '같은 앱으로 워크아웃을 GPX/FIT 로 내보내세요.': 'Export the workout as GPX / FIT from the same app.',
    '또는': 'or',
    '원본 내보내기': 'Export Original',
    '심박만': 'HR only',
    '양끝': 'Both ends',
    '아직 저장된 세션이 없습니다. 위에서': 'No saved sessions yet. Tap',
    '을 누르면\n        시즌별 성장 흐름과 개인 베스트가 여기에 쌓입니다.': 'above to build seasonal trends and personal-best records here.',
    '(휴식·표류\n        등)이 만들어지고, 제외 구간을 누르면 해제됩니다. 편집은 실제 시간을 기준으로\n        하며 즉시 거리·속도·회전 분석에 반영됩니다.': '(rest / drift, etc.) become excluded segments; tap an excluded segment to remove the exclusion. Edits are time-based and immediately update distance · speed · maneuver analysis.',
    '윙 사이즈는 Coach Danny what-if 분석의 필수 입력입니다.\n        풍속은 아래': 'Wing size is required for Coach Danny what-if analysis. Wind speed is entered in the',
    '카드에서 입력합니다. 프론트 윙 면적 조언은 v2 범위입니다.': 'card below. Front-wing area advice is planned for v2.',
    '제외 구간': 'Excluded segment',
    '라이딩 오버랩': 'Riding overlay',
    '을 드래그해 워밍업·이동 구간을 잘라내면 남은 트랙이\n        가로 폭을 꽉 채웁니다. 그래프 위를 가로로 드래그하면': 'to trim warm-up / transit sections; the remaining track fills the full width. Drag horizontally over the graph to add',
    '위 회전 목록 또는 지도에서 회전을 선택하면 정점 ±10초 곡선이 표시됩니다.\n        여러 회전을 선택하면 겹쳐 그리고 평균 곡선을 함께 보여줍니다.': 'Select a maneuver from the list or map above to show the apex ±10s curve. Select multiple to overlay them with a mean curve.',
    '윙': 'Wing',
    '포일': 'Foil',
    '보드': 'Board',
    '안전장비': 'Safety gear',
    '핸들': 'Handle',
    '여성 라이더': 'Women riders',
    '유소년·어린이': 'Junior / kids',
    '가족 라이딩': 'Family riding',
    'Levitaz': 'Levitaz',
    'PPC': 'PPC',
    'Takoon': 'Takoon',
    'Forward WIP': 'Forward WIP',
    '올림픽공인 하이드로포일/보드': 'Olympic-certified hydrofoil / board',
    '하이퍼포먼스 윙': 'High-performance wing',
    '부담없는 시작': 'Easy start',
    '탑라이더들의 안전장비': 'Top-rider safety gear',
    '핸들·붐·FDS 윙': 'Handle · boom · FDS wing',
    'FW·Mast·Stab·세트': 'FW · Mast · Stab · set',
    '입문 보드·중상급 셰이프': 'Entry boards · intermediate-advanced shapes',
    '헬멧·임팩트 베스트·하니스': 'Helmet · impact vest · harness',
    '평수면·속도': 'Flat water · speed',
    '한국 일반 스팟': 'Typical Korean spots',
    '파도·서핑': 'Waves · surf',
    '다목적': 'Versatile',
    '글라이딩 단계': 'Gliding phase',
    '테이크오프·기본 라이딩': 'Take-off · basic riding',
    'Jibe·tack 정복': 'Jibe / tack mastery',
    '전문 분야 진입': 'Specialty entry',
    'Race·대회': 'Race · competition',
    '안전·작은 사이즈': 'Safety · small sizes',
    '3-4 set 번들': '3–4 set bundle',
    'Language / 언어': 'Language',
    'Phase 2 예정': 'Phase 2 (planned)',
    '검색 (Phase 2 예정)': 'Search (Phase 2 planned)',
    '메뉴 닫기': 'Close menu',
    '메뉴 열기': 'Open menu',
    '속도 단위': 'Speed unit',
    '속도 오버랩': 'Speed overlay',
    '장바구니': 'Cart',

    /* === Main-site header / trust-bar / nav labels (Danny 2026-05-26)
       inSkipZone 에서 .site-header / .trust-bar 자동 skip 을 제거했으므로
       이 라벨들도 EN 모드에서 영문 변환된다. */
    '3회 올림픽 출전 코치 운영': '3× Olympic-experienced coach',
    '네 브랜드 정식 수입': 'Authorized importer for 4 brands',
    '당일 출고': 'Same-day shipping',
    '1:1 카톡 컨설팅': '1:1 KakaoTalk consultation',
    '브랜드': 'Brands',
    '라이딩 스타일': 'Riding style',
    '장비': 'Gear',
    '실력 수준': 'Skill level',
    '스마트 컨설팅 ↗': 'Smart Consult ↗',
    '로그인': 'Login',
    '공방': 'Gongbang',
    '단무지 홈': 'DMJ Gongbang home',
    '단무지': 'DMJ Gongbang',
    '주 메뉴': 'Main menu',
    '카톡 상담': 'KakaoTalk support',

    /* === nav-auth 동적 주입 드롭다운 (계정 메뉴) — Danny 2026-05-26 검수 ===
       nav-auth.js 가 로그인 후 동적으로 inject 하는 계정 드롭다운. 정적
       HTML 에는 없어서 그 동안 누락. walker MutationObserver 가 잡아 번역. */
    '마이페이지': 'My Page',
    '프로필 · 장비 · 진단 결과': 'Profile · Gear · Diagnosis',
    '라이딩 분석': 'Riding Analysis',
    'GPX 세션 분석': 'GPX Session Analysis',
    '스킬 진단': 'Skill Diagnosis',
    '1분 셋업 진단': '1-min Setup Diagnosis',
    '회원 등급': 'Membership Tier',
    '현재 등급 · 혜택': 'Current tier · benefits',
    '로그아웃': 'Logout',
    '다음 30일 자동 로그인': 'Stay signed in for 30 days',

    /* === 대시보드 본문 잔존 (Danny 2026-05-26 라이브 검수) === */
    '평균 속도 · 최고 속도': 'Avg speed · Top speed',
    '개 세션 합계': 'session total',
    '윙포일·SUP 네 가지 브랜드 정식 수입 큐레이션. 한국 라이더 spot 환경에 맞게 컨설팅합니다.':
      'Authorized 4-brand wingfoil / SUP curation. Consulting tailored to Korean rider spots.',
    '까지 — 일반 GPS 앱이 보여주지 않는\n         코치 등급 분석을 바로 확인할 수 있습니다.':
      '— coach-grade analysis that ordinary GPS apps don’t show.',
  };

  /* ============================================================
   * 상태 + 영속화
   * ============================================================ */
  var lang = 'ko';
  try {
    var stored = localStorage.getItem(STORE_KEY);
    if (stored === 'ko' || stored === 'en') lang = stored;
  } catch (e) { /* localStorage disabled */ }

  function getLang() { return lang; }

  function setLang(l) {
    if (l !== 'ko' && l !== 'en') return;
    if (l === lang) return;
    lang = l;
    try { localStorage.setItem(STORE_KEY, l); } catch (e) {}
    document.documentElement.setAttribute('lang', l === 'en' ? 'en' : 'ko');
    document.documentElement.setAttribute('data-rd-lang', l);
    /* 토글 버튼 상태 반영 */
    updateToggleButtons();
    /* 구독자(앱)가 재렌더하도록 알림 — RDDashboard.rerender() 등 */
    window.dispatchEvent(new CustomEvent('rd:langchange', { detail: { lang: l } }));
    /* 정적 DOM 즉시 번역 / 복원 */
    if (l === 'en') translateAll(document.body);
    else restoreAll(document.body);
  }

  /* ============================================================
   * T(ko, vars) — 호출부 변환 (캔버스·동적 보간 등)
   * ============================================================ */
  function T(ko, vars) {
    var s = (lang === 'en' && MAP[ko] != null) ? MAP[ko] : ko;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.split('{' + k + '}').join(String(vars[k]));
      });
    }
    return s;
  }

  /* ============================================================
   * DOM 자동 번역 / 복원
   * 매칭 단위 = 텍스트노드의 trimmed 전체 (부분 매치 X — 충돌 방지).
   * 원문은 textNode._rdOrig / element._rdOrigAttrs 에 보존.
   * ============================================================ */
  /* 번역 범위 — 대시보드 페이지에서는 페이지 전체를 번역 대상으로 둔다
     (헤더·트러스트바 포함). EN 모드에서 한글이 100% 사라지게 하려면 메인
     사이트 헤더 라벨도 함께 번역해야 한다 (Danny 2026-05-26).
     명시적으로 번역에서 제외하고 싶은 영역은 [data-rd-i18n-skip] 속성으로
     opt-out 한다. 이전엔 .site-header / .trust-bar 를 자동 skip 했지만,
     이 정책으로 EN 모드 polish 가 막혔다 — 자동 skip 제거. */
  function inSkipZone(node) {
    var el = node.nodeType === 1 ? node : node.parentElement;
    while (el && el !== document.body) {
      if (el.hasAttribute && el.hasAttribute('data-rd-i18n-skip')) return true;
      el = el.parentElement;
    }
    return false;
  }

  /* 보간 동적 문자열용 정규식 패턴 — 'GPS 포인트 5,468개 전량 사용' 같이
     숫자/시간 등이 섞인 런타임 문자열을 패턴 매칭으로 번역. PATTERNS 끝의
     en 문자열은 $1·$2 백참조로 캡처 그룹을 끼워 넣는다 (Phase 2-C). */
  var PATTERNS = [
    /* career-tile 누적 횟수 단위 — '4 회' 같은 short label (Danny 2026-05-26) */
    { ko: /^(\d+) 회$/, en: '$1 sessions' },
    /* career-tile sub '4개 세션 합계' (number + 개 세션 합계) */
    { ko: /^(\d+)개 세션 합계$/, en: '$1-session total' },
    { ko: /^GPS 포인트 ([\d,]+)개 전량 사용$/, en: 'GPS points: $1 (all used)' },
    { ko: /^편집 적용 ([\d,]+)개 분석$/, en: 'Edit applied — $1 points analyzed' },
    { ko: /^속도원: 기기 기록$/, en: 'Speed source: device record' },
    { ko: /^속도원: GPS 좌표 계산$/, en: 'Speed source: GPS-derived' },
    { ko: /^임계 ([\d.]+) (kt|km\/h) 이상$/, en: 'Threshold ≥ $1 $2' },
    { ko: /^전체 ([\dhms: ]+)$/, en: 'Total $1' },   /* §410 — 콜론 포함(전체 2:03:23) */
    { ko: /^편집됨 · (.+?) · 분석 길이 (.+)$/, en: 'Edited · $1 · analyzed length $2' },
    { ko: /^원본 전체 \((.+)\)$/, en: 'Full track ($1)' },
    { ko: /^앞 (.+?) 잘림$/, en: 'Trimmed front $1' },
    { ko: /^뒤 (.+?) 잘림$/, en: 'Trimmed back $1' },
    { ko: /^제외 (\d+)구간$/, en: '$1 excluded section(s)' },
    { ko: /^([\d.]+)% 비율$/, en: '$1% ratio' },
    { ko: /^오늘의 세션 속도 \((노트|km\/h)\)$/, en: 'Today’s session speed ($1)' },
    { ko: /^오늘의 세션 속도 \(노트\)$/, en: 'Today’s session speed (knots)' },
    { ko: /^✓ 풍향 (\d+)° \((.+?)\) 확정 — 택킹\/자이빙·VMG·폴라에 반영되었습니다\.$/,
      en: '✓ Wind direction $1° ($2) confirmed — tack / gybe, VMG and polar updated.' },
    { ko: /^✓ 풍향 (\d+)° \((.+?)\) 확정$/, en: '✓ Wind $1° ($2) confirmed' },
    { ko: /^풍향 (\d+)° \((.+?)\) · (.+)$/, en: 'Wind $1° ($2) · $3' },
    { ko: /^✦ 권장 추정값 (\d+)° \((.+?)\) · 신뢰도 (.+?) — (.+) 다이얼·슬라이더로 보정 후 “확정”을 누르세요\.$/,
      en: '✦ Recommended estimate $1° ($2) · confidence $3 — $4 Adjust via dial / slider, then tap "Confirm".' },
    { ko: /^권장 추정값 (\d+)° \((.+?)\) · 신뢰도 (.+?) — (.+) 다이얼·슬라이더로 보정 후 “확정”을 누르세요\.$/,
      en: 'Recommended estimate $1° ($2) · confidence $3 — $4 Adjust via dial / slider, then tap "Confirm".' },
    { ko: /^추정값 (\d+)° \((.+?)\) 을\(를\) 미리보기에 적용했습니다 — 다이얼로 보정 후 “확정”을 누르세요\.$/,
      en: 'Applied estimate $1° ($2) to preview — adjust via dial, then tap "Confirm".' },
    { ko: /^신뢰도 (.+)$/, en: 'Confidence $1' },
    { ko: /^무항주 구역 폭 (\d+)°$/, en: 'No-go zone width $1°' },
    { ko: /^그리드 정렬도 ([\d.]+)$/, en: 'Grid alignment $1' },
    { ko: /^회전 (\d+)개$/, en: '$1 maneuvers' },
    { ko: /^추정 분산 ([\d.]+)°$/, en: 'Spread $1°' },
    { ko: /^풍상·풍하 판정 여유 ([\d.]+)%p$/, en: 'Upwind / downwind margin $1%p' },
    { ko: /^✗ (.+)$/, en: '✗ $1' },
    { ko: /^⚠ (.+)$/, en: '⚠ $1' },
    { ko: /^✓ (.+)$/, en: '✓ $1' },
    { ko: /^▾ 소스 접기$/, en: '▾ Collapse sources' },
    { ko: /^▸ 소스 펴기$/, en: '▸ Expand sources' },
    { ko: /^(\d+) \/ (\d+)회 성공 · 세션 전체 기준$/, en: '$1 / $2 success · whole-session basis' },
    { ko: /^(\d+) \/ (\d+)회 성공$/, en: '$1 / $2 success' },
    { ko: /^(\d+) times$/, en: '$1 times' },
    { ko: /^(\d+)회$/, en: '$1 times' },
    { ko: /^(\d+)점$/, en: '$1 pts' },
    { ko: /^(\d+) score$/, en: '$1 score' },
    { ko: /^총 (\d+)회 중 (\d+)회 표시$/, en: 'Showing $2 of $1 total' },
    { ko: /^택킹 (\d+)회 중 (\d+)회 표시$/, en: 'Showing $2 of $1 tacks' },
    { ko: /^자이빙 (\d+)회 중 (\d+)회 표시$/, en: 'Showing $2 of $1 gybes' },
    { ko: /^(택킹|자이빙) (\d+)회 — 포트 (\d+) · 스타보드 (\d+) 좌우 분할 비교 \(Y축 동일 스케일\)$/,
      en: '$1 ×$2 — Port $3 · Starboard $4 split comparison (same Y-axis)' },
    { ko: /^(.+?) (\d+)회 겹쳐 보기 — 개별 곡선\(연한 선\) \+ 평균\(굵은 선\) \+ ±1σ 밴드$/,
      en: '$1 ×$2 overlaid — individual (light) + mean (bold) + ±1σ band' },
    { ko: /^(택킹|자이빙) (\d+)회$/, en: '$1 × $2' },
    { ko: /^(포트|스타보드) ([\d.]+)$/, en: '$1 $2' },
    { ko: /^임계 ([\d.]+) (kt|km\/h)/, en: 'Threshold $1 $2' },
    { ko: /^예: (.+)$/, en: 'e.g. $1' },
    { ko: /^심박이 함께 기록된 (택킹|자이빙|회전)$/, en: '$1 with HR' },
    { ko: /^심박이 함께 기록된 택킹·자이빙$/, en: 'Tacks / gybes with HR' },
    { ko: /^회복 표본 (\d+)회 평균 · 클수록 빠른 회복$/, en: 'Avg of $1 recovery samples — higher = faster recovery' },
    { ko: /^기록 포인트 ([\d,]+)개 중 심박 ([\d,]+)개$/, en: '$2 HR samples among $1 recorded points' },
    { ko: /^(.+) · 순항 대비$/, en: '$1 · vs cruise HR' },
    { ko: /^입력하신 최대 심박수 (\d+) bpm 기준으로 존을 나눕니다\.$/,
      en: 'Zones based on your max HR of $1 bpm.' },
    { ko: /^미입력 — 세션 관측 최대값 (\d+) bpm 을 기준으로 합니다\. 본인의 최대 심박수를 입력하시면 더 정확해집니다\.$/,
      en: 'Not entered — using session-observed max of $1 bpm. Enter your max HR for higher accuracy.' },
    { ko: /^타깃 = 저장된 세션 (\d+)개의 TWA별 개인 베스트\(지속 속도 95퍼센타일\)입니다\.$/,
      en: 'Target = personal-best per TWA bin (sustained-speed 95th percentile) across $1 saved sessions.' },
    { ko: /^✦ 권장 추정값 (\d+)° \((.+?)\) · 신뢰도 (.+?) — (.+)$/,
      en: '✦ Recommended estimate $1° ($2) · confidence $3 — $4' },
    { ko: /^주행의 (\d+)%만 타깃 보유$/, en: '$1% of sailing has target coverage' },
    { ko: /^점선 빈 (\d+)개\(표본 없음·보간 추정\)$/,
      en: '$1 dashed bins (no samples — interpolated)' },
    { ko: /^연한 점 빈 (\d+)개\(표본 60초 미만\)$/,
      en: '$1 faint-dot bins (under 60s samples)' },
    { ko: /^선택 (\d+)회 · (.+)$/, en: 'Selected $1 · $2' },
    { ko: /^(\d+) 선택$/, en: '$1 selected' },
    { ko: /^표본 (\d+)$/, en: '$1 samples' },
    { ko: /^표본 P (\d+)개 · S (\d+)개$/, en: 'Samples P $1 · S $2' },
    { ko: /^([\d.]+) 비교$/, en: '$1 compared' },
    { ko: /^주행의 ([\d.]+)%만 타깃 보유$/, en: '$1% of sailing has target coverage' },
    { ko: /^(\d+) ?(min|sec|sec|초|분) 비교$/, en: '$1 $2 compared' },
    { ko: /^([\d.]+) 분 \((.+?) ~ (.+?)\)$/, en: '$1 min ($2 — $3)' },
    /* 세션 헤더 source 문자열 — '속도원: GPS 좌표 계산 · GPS 포인트 N개 전량 사용 · 편집 적용 M개 분석' */
    { ko: /^(속도원: .+?) · (GPS 포인트 [\d,]+개 전량 사용)$/, en: '$1 · $2' },
    { ko: /^(속도원: .+?) · (GPS 포인트 [\d,]+개 전량 사용) · (편집 적용 [\d,]+개 분석)$/,
      en: '$1 · $2 · $3' },
    { ko: /^풍상·풍하 통계는 풍향 확정 후 주행 표본의 시간가중값입니다 \(풍상 (.+?) · 풍하 (.+?) 기준\)\.$/,
      en: 'Upwind / downwind stats are time-weighted over riding samples after the wind is confirmed (upwind $1 · downwind $2).' },
    { ko: /^타깃 = 저장된 세션 (\d+)개의 TWA별 개인 베스트.*\.$/,
      en: 'Target = personal-best per TWA bin (sustained-speed 95th percentile) across $1 saved sessions.' },
    { ko: /^그래프 중간의 옅은 띠는 GPS 장치가 8초 넘게 기록을 멈춘 시간대\(또는 트랙 편집에서 제외한 구간\)입니다 — 이 세션 (\d+)곳\..+$/,
      en: 'The faint bands in the chart mark gaps where the GPS device paused for over 8s (or excluded sections from track editing) — $1 in this session. "HR coverage" measures HR-attached share of recorded points, so it can still be near 100% even with such time gaps — they measure different things.' },
    { ko: /^심박 효율 지수 = 주행 평균 속도\(.+?\) ÷ 평균 심박\(bpm\) × 100 입니다\..*$/,
      en: 'HR efficiency index = sailing avg speed ÷ avg HR × 100. Higher = faster at the same HR — better aerobic efficiency. Watching this rise across sessions signals improving fitness. In the scatter below, points lower (lower HR at the same speed) indicate better efficiency.' },
    { ko: /^심박 드리프트는 활주 구간의 후반 평균 심박이 전반보다.*$/,
      en: 'HR drift = late-half average HR minus early-half during active riding — closer to 0 means you held the same effort to the end.' },
    { ko: /^✓ 회전 직전\(4초 평균\)보다 최저 속도가 더 빠릅니다 — 속도를 잃지 않고 오히려 가속하며 빠져나온 좋은 회전입니다\..*$/,
      en: '✓ Minimum speed exceeded the pre-entry (4-second average) — a strong maneuver that accelerated through rather than losing speed. Loss is computed against the faster of entry/exit ($1).' },

    /* ─── §410 — 영문 모드 잔존 동적 문자열 (옥대표님 verbatim 2026-06-10) ─── */
    /* 풍향 추정 신뢰도 디테일 (괄호 묶음) */
    { ko: /^\(무항주 구역 폭 (\d+)° · 그리드 정렬도 ([\d.]+)\)$/,
      en: '(No-go zone width $1° · grid alignment $2)' },
    { ko: /^\(회전 (\d+)개 · 추정 분산 ([\d.]+)° · 풍상·풍하 판정 여유 ([\d.]+)%p\)$/,
      en: '(Maneuvers $1 · spread $2° · upwind / downwind margin $3%p)' },
    /* SPS·장비 코칭 — 입력 부족 안내 (missing 입력 라벨은 이미 EN) */
    { ko: /^세일링 퍼포먼스 스코어를 산출하려면 다음 입력이 더 필요합니다 — (.+)\.$/,
      en: 'To compute the Sailing Performance Score, more inputs are needed — $1.' },
    { ko: /^장비 코칭을 시작하려면 다음 입력이 더 필요합니다 — (.+?)\. what-if 는 실측 풍상 VMG 에 맞춰 산출되므로 풍향 확정이 필요합니다\.$/,
      en: 'To start gear coaching, more inputs are needed — $1. The what-if is computed against measured upwind VMG, so the wind must be confirmed.' },
    /* 퍼포먼스 통계 패널 — 설명 문단(풍상/풍하 주행시간 보간) */
    { ko: /^풍상·풍하 통계는 풍향 확정 후 주행 표본의 시간가중값입니다 \(풍상 (.+?) · 풍하 (.+?) 기준\)\. SOG·VMG·TWA·힐·피치는.*$/,
      en: 'Upwind / downwind stats are time-weighted over riding samples after the wind is confirmed (upwind $1 · downwind $2). SOG, VMG, TWA, heel and pitch are split into 4 buckets — upwind/downwind × port/starboard — to compare the two tacks (HR is independent of tack, so it is split only by upwind/downwind). Three ranges are shown — average, top 50% and top 20%: the average is the time-weighted mean of that direction, and the top N% is the time-weighted segment mean (excluding single-GPS-point noise). “Top” follows each metric’s good direction (higher SOG/VMG, narrower upwind TWA); neutral metrics use the larger-magnitude side. Heel is shown with its sign as-is — port (−) and starboard (+).' }
  ];

  function applyPatterns(s) {
    for (var i = 0; i < PATTERNS.length; i++) {
      var m = s.match(PATTERNS[i].ko);
      if (m) {
        return PATTERNS[i].en.replace(/\$(\d+)/g, function (_, n) {
          return m[+n] != null ? m[+n] : '';
        });
      }
    }
    return null;
  }

  function translateTextNode(n) {
    var v = n.nodeValue;
    if (v == null) return;
    var trimmed = v.replace(/^\s+|\s+$/g, '');
    if (!trimmed) return;
    if (inSkipZone(n)) return;
    var out = (MAP[trimmed] != null) ? MAP[trimmed] : applyPatterns(trimmed);
    if (out == null) return;
    if (out === trimmed) return;   // 동일 → 무한 mutation 루프 방지
    if (n._rdOrig == null) n._rdOrig = v;
    var lead = v.match(/^\s*/)[0], trail = v.match(/\s*$/)[0];
    n.nodeValue = lead + out + trail;
  }
  function restoreTextNode(n) {
    if (n._rdOrig != null) {
      n.nodeValue = n._rdOrig;
      n._rdOrig = null;
    }
  }

  var ATTRS = ['title', 'aria-label', 'placeholder', 'alt'];
  function translateAttrs(el) {
    if (!el || !el.hasAttribute) return;
    if (inSkipZone(el)) return;
    ATTRS.forEach(function (a) {
      if (!el.hasAttribute(a)) return;
      var v = el.getAttribute(a);
      var trimmed = (v || '').replace(/^\s+|\s+$/g, '');
      if (!trimmed) return;
      var out = (MAP[trimmed] != null) ? MAP[trimmed] : applyPatterns(trimmed);
      if (out == null) return;
      if (out === trimmed) return;
      if (!el._rdOrigAttrs) el._rdOrigAttrs = {};
      if (el._rdOrigAttrs[a] == null) el._rdOrigAttrs[a] = v;
      var lead = v.match(/^\s*/)[0], trail = v.match(/\s*$/)[0];
      el.setAttribute(a, lead + out + trail);
    });
  }
  function restoreAttrs(el) {
    if (!el || !el._rdOrigAttrs) return;
    Object.keys(el._rdOrigAttrs).forEach(function (a) {
      el.setAttribute(a, el._rdOrigAttrs[a]);
    });
    el._rdOrigAttrs = null;
  }

  function walkTextNodes(root, fn) {
    if (!root) return;
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = w.nextNode())) fn(n);
  }
  function walkElements(root, fn) {
    if (!root) return;
    if (root.nodeType === 1) fn(root);
    var els = root.querySelectorAll ? root.querySelectorAll('*') : [];
    for (var i = 0; i < els.length; i++) fn(els[i]);
  }

  function translateAll(root) {
    walkTextNodes(root, translateTextNode);
    walkElements(root, translateAttrs);
  }
  function restoreAll(root) {
    walkTextNodes(root, restoreTextNode);
    walkElements(root, restoreAttrs);
  }

  /* ============================================================
   * MutationObserver — 동적으로 들어온 노드도 자동 번역(en 일 때)
   * ============================================================ */
  var observerStarted = false;
  function startObserver() {
    if (observerStarted || !document.body) return;
    observerStarted = true;
    var obs = new MutationObserver(function (muts) {
      if (lang !== 'en') return;
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === 'childList') {
          m.addedNodes.forEach(function (n) {
            if (n.nodeType === 1) translateAll(n);
            else if (n.nodeType === 3) translateTextNode(n);
          });
        } else if (m.type === 'characterData') {
          translateTextNode(m.target);
        } else if (m.type === 'attributes') {
          translateAttrs(m.target);
        }
      }
    });
    obs.observe(document.body, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: ATTRS
    });
  }

  /* ============================================================
   * 토글 버튼 설치 — body 안 어디든 [data-rd-lang-btn] 자동 결선
   * ============================================================ */
  function updateToggleButtons() {
    var btns = document.querySelectorAll('[data-rd-lang-btn]');
    for (var i = 0; i < btns.length; i++) {
      var l = btns[i].getAttribute('data-rd-lang-btn');
      btns[i].setAttribute('aria-pressed', l === lang ? 'true' : 'false');
      if (l === lang) btns[i].classList.add('is-on');
      else btns[i].classList.remove('is-on');
    }
  }
  function setupToggle() {
    var btns = document.querySelectorAll('[data-rd-lang-btn]');
    for (var i = 0; i < btns.length; i++) {
      (function (b) {
        var l = b.getAttribute('data-rd-lang-btn');
        b.addEventListener('click', function () { setLang(l); });
      })(btns[i]);
    }
    updateToggleButtons();
  }

  /* ============================================================
   * 부팅
   * ============================================================ */
  /* 토글 UI CSS — 외부 css 파일 의존 없이 self-contained 주입 */
  function injectStyle() {
    if (document.getElementById('rd-i18n-style')) return;
    var css =
      /* Danny 2026-06-03(③): 우상단 토글을 site-header(높이 72px·sticky) 의 nav 링크와
         같은 라인·수직 가운데로 정렬. top:23px = (72-26)/2, right=컨테이너 gutter(데스크탑 2rem). */
      '.rd-langtoggle{position:fixed;top:23px;right:2rem;z-index:9999;' +
        'display:inline-flex;align-items:center;background:#FFFFFFE6;border:1px solid #C7CFD8;' +
        'border-radius:999px;padding:2px;box-shadow:0 2px 8px rgba(10,37,64,0.08);' +
        'font:600 12px system-ui,-apple-system,sans-serif;backdrop-filter:blur(6px)}' +
      '.rd-langtoggle__btn{appearance:none;border:0;background:transparent;' +
        'color:#5C6F7E;padding:5px 12px;border-radius:999px;cursor:pointer;' +
        'min-width:54px;letter-spacing:.01em;line-height:1;transition:all .12s ease}' +
      '.rd-langtoggle__btn:hover{color:#0A2540}' +
      '.rd-langtoggle__btn.is-on{background:#0A2540;color:#FFFFFF;' +
        'box-shadow:0 1px 3px rgba(10,37,64,0.18)}' +
      /* 768px 미만: 컨테이너 gutter 1.25rem 에 우측 정렬. 헤더 높이 72px 유지 → 수직 중앙 동일. */
      '@media (max-width:767px){.rd-langtoggle{right:1.25rem}}' +
      '@media (max-width:540px){.rd-langtoggle{top:24px}' +
        '.rd-langtoggle__btn{padding:5px 10px;min-width:46px;font-size:11px}}' +
      /* 리플레이(영어 전용 몰입 모드) 열림 시 전역 토글 숨김 — ✕ 닫기 버튼과
         겹침 방지 (데이빗 2026-06-03). */
      'body.rd-replay-active .rd-langtoggle{display:none!important}';
    var s = document.createElement('style');
    s.id = 'rd-i18n-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function init() {
    document.documentElement.setAttribute('data-rd-lang', lang);
    if (lang === 'en') document.documentElement.setAttribute('lang', 'en');
    injectStyle();
    setupToggle();
    startObserver();
    if (lang === 'en') translateAll(document.body);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ============================================================
   * 공개 API
   * ============================================================ */
  global.RDI18n = {
    T: T, getLang: getLang, setLang: setLang,
    MAP: MAP,
    translateNode: function (n) { if (lang === 'en') translateAll(n); },
    restoreNode: function (n) { restoreAll(n); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
