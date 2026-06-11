# Shekinah Sons Global App

This repository contains the Phase 1 and Phase 2 implementation for the Shekinah Sons Global church app:

- `phase1_app/`: Expo React Native mobile app for members.
- `backend/`: Go API with PostgreSQL storage, authentication, public content APIs, admin APIs, giving, notifications, and startup migrations.
- `admin_dashboard/`: React/Vite admin dashboard for managing content and broadcasts.

## Phase Status

### Phase 1: Member App Foundation

Complete for local Expo testing.

- Black/gold Shekinah mobile UI with Home, Sermons, Devotions, Live, Bible, Events, Giving, Branches, Prayer Wall, Profile, Downloads, About, Updates, Platforms, and Serve screens.
- Offline Bible database bundled in `phase1_app/assets/bible/bible.db`.
- Backend content connection through `EXPO_PUBLIC_API_BASE_URL`, with local fallback data when the API is unavailable.
- Logo and generated app icons already wired through the mobile project.

### Phase 2: Backend and Admin

Complete for development and deployment setup.

- Go backend with PostgreSQL persistence.
- Automatic startup migrations from `backend/migrations`.
- Seed admin account for first local login.
- Admin dashboard for sermons, devotions, events, updates, branches, live stream config, giving records, and notifications.
- Render blueprint for backend, database, and admin dashboard deployment.
- Local Docker Compose PostgreSQL setup.

### Phase 3: Production Launch Work

Left for final owner completion.

- Replace all placeholder content with approved church content, branch data, real phone numbers, schedules, and vision/about text.
- Add production service credentials: Cloudinary, OneSignal, M-Pesa Daraja, card processor, Google Maps, and Bible version provider.
- Configure production domains, privacy policy, Play Store listing, app signing, and final APK/AAB release.
- Run real payment, notification, livestream, and offline-download QA with church staff.

## Local Setup

Start PostgreSQL:

```bash
docker compose up -d postgres
```

The local database is exposed on port `55432` to avoid conflicts with any existing PostgreSQL running on `5432`.

Start the backend:

```bash
cd backend
DATABASE_URL="postgres://shekinah:shekinah@localhost:55432/shekinah?sslmode=disable" \
JWT_SECRET="dev-secret" \
go run ./cmd/api
```

The API runs on `http://localhost:3000`.

Admin login for local development:

```text
Email: vincent@example.com
Password: password123
```

This seeded account is intentionally marked as requiring a password reset. The admin dashboard will route it to the reset-password screen before admin pages are available.

Start the admin dashboard:

```bash
cd admin_dashboard
npm install
npm run dev
```

Start the mobile app with Expo:

```bash
cd phase1_app
npm install
EXPO_PUBLIC_API_BASE_URL="http://YOUR_LAN_IP:3000" npx expo start
```

Use your computer's LAN IP for physical phone testing in Expo Go. Android emulators can usually use `http://10.0.2.2:3000`.

## Verification

Backend:

```bash
cd backend
GOCACHE=/tmp/shekinah-go-cache GOMODCACHE=/tmp/shekinah-go-mod go test ./...
```

Admin:

```bash
cd admin_dashboard
npm run build
```

Mobile export check:

```bash
cd phase1_app
npx expo export --platform android --output-dir /tmp/shekinah-mobile-export
```

## Deployment

`render.yaml` defines:

- PostgreSQL database.
- Go backend service.
- Static admin dashboard.

After deployment, set the mobile app `EXPO_PUBLIC_API_BASE_URL` to the production backend URL before creating the release build.

Phase 3 production files live in `docs/production/`.
