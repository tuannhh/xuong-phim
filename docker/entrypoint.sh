#!/bin/sh
# Chuẩn bị thư mục dữ liệu rồi chạy lệnh (mặc định: trang web).
set -e
mkdir -p /app/series /data/output /data/config /data/cache
exec "$@"
