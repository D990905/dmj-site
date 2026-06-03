#!/bin/bash
# 단무지공방 사이트 푸시 — 더블클릭 1회로 GitHub 반영
cd "$(dirname "$0")"

echo "════════════════════════════════════"
echo "   단무지공방 사이트 푸시"
echo "════════════════════════════════════"
echo ""

# iCloud 동기화 잠금 파일 정리 (있으면)
rm -f .git/index.lock .git/HEAD.lock .git/refs/heads/*.lock 2>/dev/null

echo "→ 변경 사항 모으는 중..."
git add -A

if git diff --cached --quiet; then
  echo "  (새로 올릴 변경 사항이 없습니다)"
else
  git commit -m "사이트 업데이트 $(date '+%Y-%m-%d %H:%M')" >/dev/null
  echo "  ✓ 커밋 완료"
fi

echo "→ GitHub에 올리는 중..."
echo ""
if git push origin main; then
  echo ""
  echo "════════════════════════════════════"
  echo "   ✅ 완료!  dmjgroup.kr 에 1~2분 후 반영됩니다."
  echo "════════════════════════════════════"
else
  echo ""
  echo "════════════════════════════════════"
  echo "   ⚠️  올리기 실패. 위의 빨간 메시지를 데이빗에게 보여주세요."
  echo "════════════════════════════════════"
fi

echo ""
read -n 1 -s -p "   (아무 키나 누르면 이 창이 닫힙니다)"
echo ""
