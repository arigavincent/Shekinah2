#!/bin/bash
# Moves the live data from today's hosting (Supabase + Cloudflare R2) into this
# server. Run once, on the server, after install.sh, during a quiet time.
#   OLD_DATABASE_URL  Supabase connection string (Render → Environment → DATABASE_URL)
#   OLD_R2_*          the current R2 storage keys (same place)
set -euo pipefail
cd "$(dirname "$0")"
: "${OLD_DATABASE_URL:?set OLD_DATABASE_URL}" "${OLD_R2_ENDPOINT:?}" "${OLD_R2_ACCESS_KEY_ID:?}" "${OLD_R2_SECRET_ACCESS_KEY:?}" "${OLD_R2_BUCKET:?}"
set -a; . ./.env; set +a

echo "== 1/3 Stopping the app on this server while data comes in"
sudo docker compose stop app

echo "== 2/3 Copying the database"
sudo docker compose exec -T postgres pg_dump --version >/dev/null
sudo docker run --rm --network shekinah_default -e PGPASSWORD="$POSTGRES_PASSWORD" postgres:17 \
  bash -c "pg_dump --no-owner --no-privileges --format=custom '$OLD_DATABASE_URL' > /tmp/old.dump &&
           psql -h postgres -U shekinah -d shekinah -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' &&
           pg_restore -h postgres -U shekinah -d shekinah --no-owner --no-privileges /tmp/old.dump"

echo "== 3/3 Copying stored files (sermons, books, covers, recordings)"
sudo docker run --rm --network shekinah_default rclone/rclone:latest copy \
  ":s3,provider=Cloudflare,endpoint=$OLD_R2_ENDPOINT,access_key_id=$OLD_R2_ACCESS_KEY_ID,secret_access_key=$OLD_R2_SECRET_ACCESS_KEY:$OLD_R2_BUCKET" \
  ":s3,provider=SeaweedFS,endpoint=http://storage:8333,access_key_id=$STORAGE_ACCESS_KEY,secret_access_key=$STORAGE_SECRET_KEY:$STORAGE_BUCKET" \
  --transfers 16 --fast-list --progress

echo "== Rewriting stored file addresses to this server"
OLD_BASE="${OLD_PUBLIC_BASE_URL:-}"
NEW_BASE="https://$MEDIA_DOMAIN/$STORAGE_BUCKET"
if [ -n "$OLD_BASE" ]; then
  sudo docker compose exec -T postgres psql -U shekinah -d shekinah -v ON_ERROR_STOP=1 <<SQL
DO \$\$ DECLARE r record; BEGIN
  FOR r IN SELECT table_name, column_name FROM information_schema.columns
           WHERE table_schema='public' AND data_type IN ('text','character varying') LOOP
    EXECUTE format('UPDATE %I SET %I = replace(%I, %L, %L) WHERE %I LIKE %L',
      r.table_name, r.column_name, r.column_name, '$OLD_BASE', '$NEW_BASE', r.column_name, '%' || '$OLD_BASE' || '%');
  END LOOP; END \$\$;
SQL
fi

sudo docker compose start app
echo "Done. Check the app, then point the phone app's server address to https://$APP_DOMAIN"
