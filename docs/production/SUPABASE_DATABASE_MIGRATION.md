# Supabase Database Migration Runbook

This project uses PostgreSQL through `DATABASE_URL`, so moving from Render Postgres to Supabase is a database URL and data migration. The backend migrations run automatically on startup.

## 1. Create Supabase Database

1. Create a Supabase project.
2. Open `Project Settings -> Database`.
3. Copy the **direct connection** URI first.
4. Make sure the URI includes SSL:

```text
postgresql://postgres.<project-ref>:<password>@aws-...supabase.com:5432/postgres?sslmode=require
```

Use the direct connection for restore/import. After migration, the backend can also use Supabase's pooler URI if needed.

## 2. Stop Writes Briefly

During final cutover, avoid new writes to Render Postgres:

- pause admin content edits
- avoid APK registration/password reset/giving tests
- avoid chat/testimony/prayer writes

This keeps the dump consistent.

## 3. Export Render Postgres

On your local machine, set the current Render database URL.

```bash
export RENDER_DATABASE_URL='postgresql://...render...'
```

Create a custom-format backup:

```bash
pg_dump "$RENDER_DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file=/tmp/shekinah_render_backup.dump
```

Optional plain SQL backup for inspection:

```bash
pg_dump "$RENDER_DATABASE_URL" \
  --no-owner \
  --no-acl \
  --file=/tmp/shekinah_render_backup.sql
```

## 4. Restore Into Supabase

Set the Supabase direct database URL:

```bash
export SUPABASE_DATABASE_URL='postgresql://postgres.<project-ref>:<password>@...supabase.com:5432/postgres?sslmode=require'
```

Restore:

```bash
pg_restore \
  --dbname="$SUPABASE_DATABASE_URL" \
  --no-owner \
  --no-acl \
  --clean \
  --if-exists \
  /tmp/shekinah_render_backup.dump
```

If Supabase complains about extension ownership, verify `pgcrypto` exists:

```bash
psql "$SUPABASE_DATABASE_URL" -c 'CREATE EXTENSION IF NOT EXISTS pgcrypto;'
```

Then rerun `pg_restore`.

## 5. Validate Supabase Data

Check core table counts:

```bash
psql "$SUPABASE_DATABASE_URL" -c "
SELECT 'users' table_name, count(*) FROM users
UNION ALL SELECT 'sermons', count(*) FROM sermons
UNION ALL SELECT 'devotions', count(*) FROM devotions
UNION ALL SELECT 'giving_transactions', count(*) FROM giving_transactions
UNION ALL SELECT 'library_items', count(*) FROM library_items
UNION ALL SELECT 'schema_migrations', count(*) FROM schema_migrations;
"
```

Check latest migration:

```bash
psql "$SUPABASE_DATABASE_URL" -c "SELECT version, applied_at FROM schema_migrations ORDER BY version DESC LIMIT 10;"
```

## 6. Point Render Backend To Supabase

In Render backend service `shekinah-sons-backend`:

1. Open `Environment`.
2. Replace `DATABASE_URL` with the Supabase connection URI.
3. Keep `sslmode=require`.
4. Save and redeploy backend.

The repo's `render.yaml` now marks `DATABASE_URL` as `sync: false`, so Render will not bind it back to the old Render database through blueprint sync.

## 7. Validate Backend After Cutover

Open:

```text
https://shekinah-sons-backend.onrender.com/api/v1/healthz
https://shekinah-sons-backend.onrender.com/api/v1/home
```

Expected:

- health returns `database: ok`
- home returns real content
- no migration errors in Render logs

Then test:

- admin login
- APK login
- sermons/devotions load
- giving history loads
- password reset request creates/logs/sends OTP
- library items load

## 8. Rollback

If Supabase fails:

1. Put the old Render Postgres URL back into `DATABASE_URL`.
2. Redeploy backend.
3. Verify `/api/v1/healthz`.

Do not delete the Render database until Supabase has run cleanly for at least a few days.
