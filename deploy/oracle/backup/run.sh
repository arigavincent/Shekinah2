#!/bin/bash
# Runs the backup once a day at BACKUP_HOUR (Nairobi time).
set -u
echo "Backups run daily at ${BACKUP_HOUR}:00 ($(date +%Z))."
while true; do
  now=$(date +%s)
  next=$(date -d "$(date +%F) ${BACKUP_HOUR}:00" +%s)
  [ "$next" -le "$now" ] && next=$((next + 86400))
  sleep $((next - now))
  /usr/local/bin/backup.sh || echo "$(date) backup FAILED"
done
