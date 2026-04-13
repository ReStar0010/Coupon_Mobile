#!/usr/bin/env bash
# 本次更動（Web points 正規化 + 現金券掃碼）本地驗證：寫入測試資料並跑相關單元測試。
#
# Usage:
#   cd Backend && source .venv/bin/activate && bash scripts/qa_local_coupro_changes.sh
#
# 前置：已 migrate。之後請另開終端機啟動 API / Web-Frontend / Expo（見專案說明）。

set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f manage.py ]]; then
  echo "請在 Backend 目錄執行（內含 manage.py）" >&2
  exit 1
fi

echo "==> Applying migrations (local DB must match models)..."
python manage.py migrate --noinput

echo "==> Seeding QA fixtures (Web journey + platform voucher + unified 6-digit code)..."
python scripts/seed_qa_local.py

echo ""
echo "==> Running Django tests for Web points lookup..."
python manage.py test tests.test_web_v1_points tests.test_e2e_user_journeys.WebConsumerJourneyE2ETest.test_web_points_lookup_syncs_progress_trackers -v 1

echo ""
echo "Done. Follow printed URLs from seed_qa_local.py and the steps in CLAUDE or team docs for manual App/Web checks."
