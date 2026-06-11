# Shekinah Backend

Go API for the Shekinah Sons Global app and admin dashboard.

## Local Development

From the repository root:

```bash
docker compose up -d postgres
```

Then run the API:

```bash
DATABASE_URL="postgres://shekinah:shekinah@localhost:55432/shekinah?sslmode=disable" \
JWT_SECRET="dev-secret" \
go run ./cmd/api
```

The server listens on `:3000` by default.

## Migrations

Migrations run automatically when the API starts. Files live in `backend/migrations`.

The migration runner records applied files in `schema_migrations`. On an already-created local database, it detects existing core tables and marks older baseline migrations as applied before running newer migrations.

## Local Admin Account

The seed migration creates:

```text
Email: vincent@example.com
Password: password123
Role: admin
```

This account is flagged with `password_reset_required = true`. Admin routes return `password_reset_required` until the password is changed through `PATCH /api/v1/auth/password`.

## Environment Variables

Required:

- `DATABASE_URL`
- `JWT_SECRET`

Optional service integrations:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `MPESA_ENV`
- `MPESA_CONSUMER_KEY`
- `MPESA_CONSUMER_SECRET`
- `MPESA_SHORTCODE`
- `MPESA_PASSKEY`
- `MPESA_CALLBACK_URL`
- `MPESA_TRANSACTION_TYPE`
- `MPESA_ACCOUNT_REFERENCE`

## Checks

```bash
GOCACHE=/tmp/shekinah-go-cache GOMODCACHE=/tmp/shekinah-go-mod go test ./...
```
