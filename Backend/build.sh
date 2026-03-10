#!/bin/bash
set -o errexit

# 印 DATABASE_URL 來確認環境變數是否正確
echo "DATABASE_URL is: $DATABASE_URL"

# 安裝依賴
pip install -r requirements.txt

# 收集靜態文件
python manage.py collectstatic --no-input

# 遷移資料庫
python manage.py migrate --no-input

# Load test 種子資料（deploy 時寫入 DB；客戶端使用 repo 內共用 config）
python manage.py seed_load_test --stage 4

# 如果需要創建 superuser，則執行此操作
# if [[ $CREATE_SUPERUSER ]]; then
#     python manage.py createsuperuser --no-input
# fi