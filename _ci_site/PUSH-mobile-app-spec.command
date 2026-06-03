#!/bin/bash
# Double-click me to commit + push the new Mobile App & Integration Engineer expert reference.
# Includes iCloud-lock retry logic (mirrors PUSH-FIX.command / PUSH-hardware-spec.command pattern).

cd "$(dirname "$0")"
echo "==> Working in: $(pwd)"

# Retry wrapper for iCloud lock timeouts
retry_git() {
  local cmd="$@"
  local tries=0
  local max=8
  while [ $tries -lt $max ]; do
    rm -f .git/index.lock
    if eval "$cmd"; then
      return 0
    fi
    tries=$((tries+1))
    echo "==> attempt $tries/$max failed, waiting 3s and retrying..."
    sleep 3
    rm -f .git/index.lock
  done
  echo "==> all $max attempts failed"
  return 1
}

echo "==> Removing any stale .git/index.lock..."
rm -f .git/index.lock

echo ""
echo "==> Adding _experts/ + this push script ..."
retry_git "git add _experts/expert_mobile_app_reference.md PUSH-mobile-app-spec.command" || { echo "ABORT: git add failed"; read -n 1; exit 1; }

echo ""
echo "==> Committing..."
git commit -m "feat(_experts): add Mobile App & Integration Engineer reference v1.0

Phase 1 research deliverable — iOS·Android 동반 앱 (SailTechHUB) +
다중 외부 디바이스 통합 (RaceBox·Movesense·Garmin·Vakaros·Polar·
Whoop·Oura·Wahoo·Coros·Suunto·Samsung Health·자체 SailTechMOTION).

Section coverage:
  1. 핵심 결론 (TL;DR) — 플랫폼·디바이스·MVP·블로커 1 page
  2. Prior Work Audit — Danny SailTechHUB Phase 0 SwiftUI 10 파일
     상태 + Garmin 'developer 등록' 발언 정합성 분석
     (BLE 표준 HRS 만 consume, Connect IQ·Connect Developer trace 없음
     — confirm 항목 plan)
  3. Native vs Cross-platform — 7축 평가 매트릭스, 산업 패턴
     (Strava/Wahoo/Garmin/Whoop native 검증), Capacitor disqualifier
     (WebView 백그라운드 정지), RN ble-plx multi-device pain points,
     Flutter 2순위, KMP shared logic 권장
  4. BLE GATT essentials — iOS CoreBluetooth + Android BLE API
     (API 31+ permission 모델, FGS connectedDevice, MTU, notify vs indicate)
  5. HealthKit · Samsung Health · Health Connect — sailing 매핑
     (★ HKWorkoutActivityType.sailing 존재 / Health Connect OTHER_WORKOUT)
  6. Garmin 3 distinct programs — Connect IQ SDK / Connect Developer Program /
     Health SDK 구분, OAuth 1.0a + webhook, Sail Racer 60k user 시장 검증
  7. Store submission 2026 — Privacy Nutrition Label / Data Safety form /
     Health Apps Declaration / KC mark (HW only)
  8. BLE OTA — Nordic DFU vs MCUboot+SMP, mcumgr-ios/android,
     foreground UX 권장
  9. 외부 디바이스 13-카테고리 audit — Racebox / Movesense / Garmin /
     HealthKit / Samsung / Whoop / Oura / Polar / Wahoo / Coros / Suunto /
     Vakaros / Sailmon (각 카드: API·auth·rate limit·KR 가용성·source URL)
  10. 통합 priority matrix + MVP spec — T1 (RaceBox/Movesense/HRS/Polar H10/
      HealthKit/.vkx) / T2 (Garmin/Samsung/Whoop/Oura/HC) / T3 / out 분류 +
      MVP 8 기능 lock + Phase 0→Phase 2 gap fix 체크리스트
  11. 협업 인터페이스 — #7 Hardware · #4 Frontend · #5 UX · #3 Sports Science · #1 VD
  12. Decision frameworks (5 트리)
  13. Variables & constants — BLE UUID / OAuth / rate limit cheat-sheet
  14. Sources — 모든 공식 docs · SDK reference · KR 가용성 출처

모든 spec 은 공식 docs / SDK reference 검증 (추정값은 'estimate' 명시).
Phase 1 production 변경 X — research·plan only.
Phase 0 SwiftUI 10 파일 보존, Phase 2 부터 Android·HealthKit·OTA 진입.

Co-Authored-By: Mobile App & Integration Engineer Persona #8 <ai@anthropic>" 2>&1 || echo "(maybe nothing to commit)"

echo ""
echo "==> Pushing to origin/main (with retry)..."
retry_git "git push origin main" || { echo "ABORT: push failed"; read -n 1; exit 1; }

echo ""
echo "==> Done! Latest commit:"
git log --oneline -1

echo ""
echo "Press any key to close..."
read -n 1
