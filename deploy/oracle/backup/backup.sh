#!/bin/bash
# 1. Dump the database (kept 14 days here).
# 2. Copy every stored file to Cloudflare R2, and the database dumps too.
set -euo pipefail
stamp=$(date +%Y-%m-%d_%H%M)
mkdir -p /backups/db
pg_dump --no-owner --format=custom --file="/backups/db/shekinah-$stamp.dump"
find /backups/db -name 'shekinah-*.dump' -mtime +14 -delete
echo "$(date) database saved: shekinah-$stamp.dump"
if [ -n "${BACKUP_R2_BUCKET:-}" ] && [ -n "${RCLONE_CONFIG_CLOUD_ENDPOINT:-}" ]; then
  # Files deleted here are kept in Cloudflare under deleted/<date>, not removed.
  rclone sync "local:${STORAGE_BUCKET}" "cloud:${BACKUP_R2_BUCKET}/storage" --backup-dir "cloud:${BACKUP_R2_BUCKET}/deleted/$stamp" --fast-list --transfers 8 --s3-no-check-bucket
  rclone copy /backups/db "cloud:${BACKUP_R2_BUCKET}/database" --s3-no-check-bucket
  echo "$(date) storage and database copied to Cloudflare R2 (${BACKUP_R2_BUCKET})"
else
  echo "$(date) Cloudflare backup not configured; local database dump only"
fi
