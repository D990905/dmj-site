#!/bin/bash
# Double-click me to commit + push the new hardware engineer expert reference.
# Includes iCloud-lock retry logic (mirrors PUSH-FIX.command pattern).

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
echo "==> Adding _experts/ ..."
retry_git "git add _experts/" || { echo "ABORT: git add failed"; read -n 1; exit 1; }

echo ""
echo "==> Committing..."
git commit -m "feat(_experts): add Hardware & Embedded Engineer reference v1.0

Phase 1 research deliverable for 단무지공방 자체 모션 센서
(Vakaros Atlas 2 대항, kitefoil/wingfoil rider analytics).

Section coverage:
  1. Prior work audit — 결과: site repo 내 hardware/sensor trace 없음
     (concept 단계 새 시작 확인)
  2. IMU & sensor fusion — BMI270 / LSM6DSO / ICM-42688-P / BNO086
     datasheet 비교, Madgwick · Mahony · quaternion math, 자기 차폐
  3. GPS & GNSS — u-blox NEO-M9N / ZED-F9P / MAX-M10S 비교, marine antenna
  4. BLE SoC / MCU / RTOS — nRF52840 / nRF54L15 / ESP32-C6 + Zephyr 권장
  5. PCB design — 4-layer stackup, 50Ω microstrip, antenna keep-out,
     NXP AN4247 자기 차폐 layout
  6. Enclosure — IP67/IPX6 + salt spray, UV-stab PC, N52 magnet calc,
     3M VHB / Sikaflex, 사출 MOQ
  7. Certification — FCC / CE RED (3.3 cybersec) / KC / UN38.3 / IEC 62133
     비용·시간 + pre-cert module 전략
  8. Sensor spec v1 + BOM — 단무지공방 Foil Sensor (Standard) ₩550k-650k,
     per-unit cost \$55-60 @ qty 1k
  9. Competitor audit — Vakaros / RaceBox / Velocitek / Sailmon /
     Movesense / Garmin quatix 7 분해 + 5 차별화 angles
  10. Roadmap — Proto → EVT → DVT → Cert → PVT → MP, ~9-10개월,
      \$155k-225k estimate, target launch 2027 Q2
  11. Decision frameworks (5 트리)
  12. Variables & constants cheat-sheet
  13. Sources (모든 datasheet · standard · forum 출처)

모든 spec 은 datasheet/공식 standard 검증 (추정값은 'estimate' 명시).
Phase 1 production 변경 X — research·spec only.
Phase 2 부터 실제 PCB·인클로저·인증 진입.

Co-Authored-By: Hardware & Embedded Engineer Persona #7 <ai@anthropic>" 2>&1 || echo "(maybe nothing to commit)"

echo ""
echo "==> Pushing to origin/main (with retry)..."
retry_git "git push origin main" || { echo "ABORT: push failed"; read -n 1; exit 1; }

echo ""
echo "==> Done! Latest commit:"
git log --oneline -1

echo ""
echo "Press any key to close..."
read -n 1
