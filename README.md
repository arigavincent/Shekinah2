# Shekinah Sons Global

Shekinah Sons Global is a full church digital platform made of three connected applications:

- A member mobile app built with Expo React Native.
- A Go backend API with PostgreSQL persistence.
- A web admin dashboard for ministry staff.

The platform helps the church publish sermons, devotions, events, books, reading plans, live-stream details, giving records, testimonies, prayer requests, community chat, Bible resources, notifications, and member check-ins from one backend.

## Current Production Shape

The project is now built as a production-ready foundation with real backend-backed flows. Some external services still depend on final provider credentials and operational configuration.

Current deployment targets:

- Mobile app: Expo / Android APK or EAS build.
- Backend: Render web service.
- Admin dashboard: Render web service.
- Database: PostgreSQL, currently prepared for Supabase using `DATABASE_URL`.
- Media storage: Cloudflare R2 configuration is present; Cloudinary variables are still supported.
- Payments: M-Pesa Daraja sandbox flow is implemented and ready for production credentials.
- Email: SMTP-based password reset OTP flow is implemented.

## Repository Structure

```text
.
├── admin_dashboard/       # TanStack/Vite/React admin console
├── backend/               # Go API, migrations, services, handlers
├── docs/                  # Production, import, admin, and migration runbooks
├── phase1_app/            # Expo React Native mobile application
├── release/               # Android and Play Store release notes/checklists
├── docker-compose.yml     # Local PostgreSQL setup
├── render.yaml            # Render blueprint for backend/admin/database
└── README.md              # Project overview
```

## Main User Roles

### Members

Members use the APK to:

- Watch or listen to sermons.
- Read daily devotions.
- Join live-stream pages and live chat.
- Read and install Bible versions for offline use.
- Highlight and bookmark Bible content.
- Give through M-Pesa or card checkout flows.
- Download receipts and invoices.
- Submit prayer requests.
- View and like testimonies.
- Read books and church learning materials.
- Follow reading plans.
- Check in using QR/member code flows.
- Receive notifications.
- Chat with the community or through private chat flows.

### Admins

Admins use the web dashboard to:

- Manage sermons, audio, videos, thumbnails, categories, and publish dates.
- Batch-upload sermons and devotions.
- Schedule sermons and devotions ahead of time.
- Manage the resource library for books and e-learning materials.
- Manage events, branches, updates, and church information.
- Moderate prayers, testimonies, and community messages.
- Configure live-stream status and video settings.
- View giving transactions.
- Download admin receipts and invoices.
- Send notifications.
- Verify check-ins.
- Manage reading plans.
- Configure serve/request-form settings.

## Mobile App

The mobile app lives in:

```text
phase1_app/
```

It is built with:

- Expo SDK 54.
- React Native 0.81.
- React 19.
- Expo AV/video/file-system/SQLite/notifications/print/sharing.
- Local AsyncStorage for session and device state.
- SQLite-backed Bible storage.

### Mobile Screens

The current mobile app includes:

- Home
- Sermons
- Sermon video detail
- Audio player
- Devotions
- Devotion detail
- Live
- Community chat
- Bible
- Bible version library and installer
- Events
- Event detail
- Giving
- Giving history, receipts, and invoices
- Prayer wall
- Testimonies
- Reading plans
- Library/books
- Downloads
- Check-in
- Notifications
- Branches
- Platforms
- Updates
- Search
- About
- Member profile
- Private chat thread
- Serve

### Mobile Runtime Behavior

The app reads content from the backend through:

```text
EXPO_PUBLIC_API_BASE_URL
```

For production builds this should point to:

```text
https://shekinah-sons-backend.onrender.com
```

For local Expo Go testing, it should point to your computer LAN IP:

```text
http://YOUR_LAN_IP:3000
```

Android emulator local backend URL:

```text
http://10.0.2.2:3000
```

### Mobile Commands

Install dependencies:

```bash
cd phase1_app
npm install
```

Run in Expo Go over LAN:

```bash
cd phase1_app
EXPO_PUBLIC_API_BASE_URL="http://YOUR_LAN_IP:3000" npx expo start --host lan --clear --port 8081
```

Run against production backend:

```bash
cd phase1_app
EXPO_PUBLIC_API_BASE_URL="https://shekinah-sons-backend.onrender.com" npx expo start --host lan --clear --port 8081
```

Export Android bundle:

```bash
cd phase1_app
npx expo export --platform android --output-dir /tmp/shekinah-mobile-export
```

Build Android preview APK through EAS:

```bash
cd phase1_app
npm run build:android:preview
```

Build Android production AAB/APK through EAS:

```bash
cd phase1_app
npm run build:android:production
```

## Backend API

The backend lives in:

```text
backend/
```

It is built with:

- Go.
- Gin HTTP router.
- PostgreSQL through pgx.
- Automatic SQL migrations.
- JWT authentication.
- Role-based admin authorization.
- M-Pesa Daraja integration.
- SMTP password reset OTP.
- Cloudflare R2/S3-compatible media upload support.
- Static fallback upload serving for local development.

### Backend Capabilities

The backend currently supports:

- Health checks.
- Home content aggregation.
- User registration and login.
- Email OTP password reset.
- Authenticated profile lookup.
- Admin password change.
- Sermon CRUD and batch imports.
- Devotion CRUD and batch imports.
- Scheduled content publishing through `publishedAt`.
- Events, updates, branches, and about content.
- Live-stream configuration.
- Cloudflare live input configuration hooks.
- Community chat and live chat.
- Prayer requests and prayer counts.
- Testimonies with approval/moderation.
- Reading plans, progress, notes, and reminders.
- Library resources for books and learning material.
- Giving through M-Pesa STK Push.
- Mock card checkout flow for development.
- Transaction status lookup.
- Receipt and invoice PDF generation.
- Admin giving transaction listing.
- Push notification device registration.
- Notification preferences and broadcasts.
- QR/member check-in code and admin verification.
- Bible version catalog, install tracking, and provider export endpoints.
- Private chat requests, contacts, threads, and messages.
- Serve-form PDF upload endpoint.

### API Groups

Public/member API base:

```text
/api/v1
```

Admin API base:

```text
/api/v1/admin
```

Core health endpoints:

```text
/healthz
/api/v1/healthz
```

### Backend Commands

Start local PostgreSQL:

```bash
docker compose up -d postgres
```

Run backend locally:

```bash
cd backend
DATABASE_URL="postgres://shekinah:shekinah@localhost:55432/shekinah?sslmode=disable" \
JWT_SECRET="dev-secret" \
go run ./cmd/api
```

Run backend tests:

```bash
cd backend
GOCACHE=/tmp/shekinah-go-cache GOMODCACHE=/tmp/shekinah-go-mod go test ./...
```

## Admin Dashboard

The admin dashboard lives in:

```text
admin_dashboard/
```

It is built with:

- React.
- TanStack Start / Router.
- Vite.
- TypeScript.
- Radix UI primitives.
- Tailwind CSS.
- React Query.
- Lucide icons.

### Admin Sections

The admin dashboard includes:

- Overview dashboard.
- Sermons.
- Devotions.
- Library.
- Reading plans.
- Events.
- Updates.
- Branches.
- Prayer moderation.
- Community/chat moderation.
- Testimony moderation.
- Live configuration.
- Check-in verification.
- Giving records.
- Notifications.
- Appearance/theme controls.
- Serve settings.

### Admin Batch Import

Sermons and devotions support two import styles:

- CSV import for large prepared lists.
- Batch wizard upload for guided item-by-item uploads.

Batch uploads use the existing single-content create endpoints after uploading media, which keeps behavior consistent with manual content creation.

Sample import files live in:

```text
docs/imports/shekinah_youtube_sermons_batch.csv
docs/imports/shekinah_monthly_devotions_batch.csv
docs/imports/BATCH_IMPORT_RUNBOOK.md
```

### Admin Commands

Install dependencies:

```bash
cd admin_dashboard
npm install
```

Run locally:

```bash
cd admin_dashboard
VITE_API_BASE_URL="http://localhost:3000" npm run dev
```

Build:

```bash
cd admin_dashboard
npm run build
```

Production backend URL:

```text
https://shekinah-sons-backend.onrender.com
```

## Database

The application uses PostgreSQL.

Migrations live in:

```text
backend/migrations/
```

The backend runs migrations automatically at startup and records applied migrations in:

```text
schema_migrations
```

Current major tables include:

- users
- sermons
- sermon_categories
- devotions
- events
- branches
- updates
- scriptures
- clips
- platforms
- prayers
- prayer_prays
- testimonies
- testimony_likes
- giving_transactions
- library_items
- reading_plans
- reading_plan_days
- reading_plan_progress
- reading_plan_notes
- reading_plan_reminders
- event_checkins
- member_checkin_codes
- community_messages
- private_chat_* tables
- notification_devices
- notification_messages
- bible_version_installs
- live_stream_config
- app_settings
- password_reset_tokens

### Supabase Migration

The repo is prepared for Supabase by making `DATABASE_URL` a manual Render secret instead of binding it permanently to the Render database.

Migration runbook:

```text
docs/production/SUPABASE_DATABASE_MIGRATION.md
```

The practical migration flow is:

1. Dump the old Render PostgreSQL database.
2. Restore it into Supabase PostgreSQL.
3. Confirm table counts.
4. Replace Render backend `DATABASE_URL` with the Supabase pooler/session URL.
5. Redeploy backend.
6. Verify `/api/v1/healthz` and `/api/v1/home`.

## Payments

### M-Pesa

The backend has M-Pesa Daraja STK Push support:

- OAuth token request.
- STK Push request.
- Callback handling.
- Transaction persistence.
- Admin transaction listing.
- Member transaction lookup.
- Receipt PDF download.
- Invoice PDF download.

Required Render environment variables:

```text
MPESA_ENV
MPESA_CONSUMER_KEY
MPESA_CONSUMER_SECRET
MPESA_SHORTCODE
MPESA_PASSKEY
MPESA_CALLBACK_URL
MPESA_TRANSACTION_TYPE
MPESA_ACCOUNT_REFERENCE
```

Sandbox defaults use shortcode:

```text
174379
```

### Receipts vs Invoices

Invoice:

- A request for payment.
- Useful when a payment is pending, failed, or needs to be recorded before completion.

Receipt:

- Proof that payment was completed.
- Includes paid status, transaction result, receipt number when available, and payment details.

## Media Storage

The backend supports remote media storage configuration.

Current Render blueprint includes Cloudflare R2-style variables:

```text
MEDIA_PROVIDER
MEDIA_REQUIRE_REMOTE_STORAGE
R2_ACCOUNT_ID
R2_ENDPOINT
R2_BUCKET
R2_PUBLIC_BASE_URL
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
```

Cloudinary variables are also present for compatibility:

```text
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

The admin media upload flow is used by sermon/devotion/library content when uploading files instead of linking external URLs.

## Email And Password Reset

Password reset uses an email OTP flow:

1. User enters email.
2. Backend creates a short-lived OTP token.
3. Backend sends the OTP through SMTP.
4. User enters OTP and new password.
5. Backend verifies the OTP and updates the password.

Required SMTP variables:

```text
SMTP_HOST
SMTP_PORT
SMTP_FROM
SMTP_USERNAME
SMTP_PASSWORD
PASSWORD_RESET_TTL_MINUTES
PASSWORD_RESET_MAX_ATTEMPTS
```

If SMTP delivery fails, the backend logs diagnostics for development and troubleshooting.

## Bible Features

The mobile app includes:

- Bundled offline Bible database.
- Bible reading screen.
- Version library.
- Bible version installation tracking.
- Provider-backed Bible catalog endpoints.
- Audio Bible provider endpoints.
- Highlighting and bookmarking behavior in the Bible UI.
- Offline storage using SQLite.

Backend Bible endpoints support:

- Listing available versions.
- Downloading version data.
- Recording installed versions for authenticated users.
- Exporting provider content into device-friendly formats.

## Live Stream And Community

The live module supports:

- Live/offline state controlled by admin.
- YouTube/live ID configuration.
- Live chat feed.
- Community chat feed.
- Active livestream context.
- Admin moderation for community messages.
- Cloudflare live input configuration hooks.

The mobile live chat was designed to behave closer to TikTok/YouTube style chat: messages flow in near real time while members type and participate.

## Reading Plans And Check-Ins

Reading plans support:

- Admin-created plans.
- Day-by-day readings.
- Member progress.
- Completion marking.
- Notes.
- Reminder preferences.

Check-ins support:

- Member check-in code retrieval.
- Member check-in history.
- Admin recent check-ins.
- Admin verification endpoint.

## Library And E-Learning

The library module supports church resources such as:

- Books.
- PDFs.
- Study materials.
- E-learning resources.
- Downloadable or readable items.

Admins can create and manage library items; members can view and open them in the APK.

## Testimonies And Prayer

Testimonies support:

- Member submissions.
- Member's own testimony list.
- Public approved testimony feed.
- Likes.
- Admin moderation.

Prayer requests support:

- Public request feed.
- Authenticated member submissions.
- Member's own prayer list.
- Pray-count actions.
- Admin review/moderation.

## Notifications

Notification support includes:

- Device registration.
- Preference updates.
- Admin message list.
- Admin broadcast endpoint.

Final production push delivery depends on the selected push provider credentials and signed-device testing.

## Deployment

Deployment is described by:

```text
render.yaml
```

It defines:

- `shekinah-sons-backend`
- `shekinah-sons-admin`
- legacy Render PostgreSQL resource for rollback

Important production URLs:

```text
Backend: https://shekinah-sons-backend.onrender.com
Admin:   https://shekinah2.onrender.com
```

Health check:

```text
https://shekinah-sons-backend.onrender.com/api/v1/healthz
```

Home content:

```text
https://shekinah-sons-backend.onrender.com/api/v1/home
```

## Required Production Environment Variables

Backend:

```text
APP_ENV
DATABASE_URL
JWT_SECRET
ALLOWED_ORIGINS
SMTP_HOST
SMTP_PORT
SMTP_FROM
SMTP_USERNAME
SMTP_PASSWORD
PASSWORD_RESET_TTL_MINUTES
PASSWORD_RESET_MAX_ATTEMPTS
MEDIA_PROVIDER
MEDIA_REQUIRE_REMOTE_STORAGE
R2_ACCOUNT_ID
R2_ENDPOINT
R2_BUCKET
R2_PUBLIC_BASE_URL
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
MPESA_ENV
MPESA_CONSUMER_KEY
MPESA_CONSUMER_SECRET
MPESA_SHORTCODE
MPESA_PASSKEY
MPESA_CALLBACK_URL
MPESA_TRANSACTION_TYPE
MPESA_ACCOUNT_REFERENCE
```

Admin:

```text
NODE_VERSION
NITRO_PRESET
VITE_API_BASE_URL
```

Mobile build:

```text
EXPO_PUBLIC_API_BASE_URL
```

Do not commit real secrets to the repository.

## Local Full-Stack Development

Start PostgreSQL:

```bash
docker compose up -d postgres
```

Start backend:

```bash
cd backend
DATABASE_URL="postgres://shekinah:shekinah@localhost:55432/shekinah?sslmode=disable" \
JWT_SECRET="dev-secret" \
go run ./cmd/api
```

Start admin:

```bash
cd admin_dashboard
VITE_API_BASE_URL="http://localhost:3000" npm run dev
```

Start Expo:

```bash
cd phase1_app
EXPO_PUBLIC_API_BASE_URL="http://YOUR_LAN_IP:3000" npx expo start --host lan --clear --port 8081
```

## Smoke Test Checklist

After every production deployment, test:

- Backend `/api/v1/healthz`.
- Backend `/api/v1/home`.
- Admin login.
- Admin sermons page.
- Admin devotions page.
- Admin media upload.
- Admin batch upload.
- Admin live toggle.
- Admin giving records.
- Mobile home content.
- Mobile login/register.
- Mobile password reset request and confirm.
- Mobile sermons list.
- Mobile video playback.
- Mobile audio playback.
- Mobile devotions.
- Mobile Bible open/read.
- Mobile Bible version install.
- Mobile live page and chat.
- Mobile giving flow.
- Mobile giving history.
- Receipt PDF download.
- Invoice PDF download.
- Testimonies.
- Prayer requests.
- Library items.
- Reading plans.
- Check-in code.

## Existing Documentation

Production:

```text
docs/production/SUPABASE_DATABASE_MIGRATION.md
docs/production/RELEASE_RUNBOOK.md
docs/production/PLAY_STORE_LISTING_DRAFT.md
docs/production/PRIVACY_POLICY_DRAFT.md
docs/production/CONTENT_INVENTORY.md
docs/production/CREDENTIALS_INVENTORY.md
docs/production/YOUTUBE_CHANNEL_INVENTORY.md
```

Imports:

```text
docs/imports/BATCH_IMPORT_RUNBOOK.md
docs/imports/shekinah_youtube_sermons_batch.csv
docs/imports/shekinah_monthly_devotions_batch.csv
```

Release:

```text
release/ANDROID_RELEASE_RUNBOOK.md
release/PLAY_STORE_SUBMISSION_CHECKLIST.md
```

## V2 Roadmap

The current project is a strong V1. V2 should focus on maturity, automation, scale, analytics, and member experience.

### V2 Product Improvements

- Full multi-branch support with branch-specific content, events, check-ins, and leaders.
- Member groups, ministries, and cell-group management.
- Volunteer scheduling and serving rosters.
- Event registration with capacity limits and ticket/QR confirmation.
- Full church directory with privacy controls.
- Pastoral care workflows for prayer follow-up.
- Testimony categories, featured stories, and approval notes.
- Better member profile completion and onboarding.
- Saved sermon playlists.
- Continue-watching and continue-listening history.
- Personalized home feed by branch, language, interests, and ministry.
- Children's church and youth-specific content sections.
- Multi-language app interface.

### V2 Admin Improvements

- Role-based permissions beyond admin/super admin.
- Audit logs for every admin action.
- Content review and approval workflow.
- Draft/publish workflow for all content types.
- Bulk edit for sermons/devotions/library/events.
- Rich text editor for devotions and articles.
- Drag-and-drop dashboard widgets.
- Better analytics for sermons, devotions, giving, reading plans, and notifications.
- Scheduled notification campaigns.
- Admin activity reports.
- Data export to CSV/PDF.
- Safer destructive-action confirmations.

### V2 Media Improvements

- Adaptive video streaming through Cloudflare Stream or another video CDN.
- Background audio playback controls.
- Better offline sermon/audio downloads.
- Media transcoding status inside admin.
- Upload progress persistence.
- Resumable uploads for large videos.
- Automatic thumbnail extraction.
- Audio waveform/progress previews.

### V2 Bible Improvements

- More Kenyan language Bible versions where licensing allows it.
- Better provider search and install UX.
- Parallel Bible reading.
- Cross references.
- Notes per verse.
- Share verse cards as images.
- Reading streaks.
- Offline audio Bible caching where licensing allows it.
- Stronger default-version selection and sync across devices.

### V2 Giving Improvements

- Production M-Pesa configuration.
- Additional payment providers.
- Recurring giving.
- Pledge tracking.
- Member giving statements.
- End-of-year giving reports.
- Finance admin roles.
- Reconciliation reports.
- Refund/void workflows where supported.
- Better handling for pending payment callbacks.

### V2 Communication Improvements

- Real push notification delivery analytics.
- Segmented notifications by branch/ministry/group.
- In-app announcements inbox.
- Better chat moderation tooling.
- Private chat blocking/reporting.
- Read receipts for private chat.
- Optional end-to-end encryption hardening review.

### V2 Infrastructure Improvements

- Move permanently to Supabase or another managed PostgreSQL provider.
- Add automated backups and restore drills.
- Add monitoring and alerting.
- Add structured logging.
- Add error tracking for backend, admin, and mobile.
- Add CI for backend tests, admin builds, and mobile export checks.
- Add staging environment separate from production.
- Add seed/demo data scripts.
- Add load testing for live chat and home endpoints.

### V2 Security Improvements

- Refresh tokens and session rotation.
- Device/session management.
- Rate limiting on auth and password reset endpoints.
- Stronger admin password policy.
- Two-factor authentication for admins.
- Admin IP/session audit.
- Content upload file scanning.
- Better CORS origin management.
- Secrets rotation runbook.

### V2 Release Improvements

- Play Store production release.
- Internal testing track.
- Crash reporting.
- Version update prompts.
- In-app changelog.
- Rollback plan for APK releases.
- Automated release notes.

## Practical Wrap-Up Status

V1 now covers the core requirements:

- Member APK experience.
- Admin-controlled content.
- Backend persistence.
- Giving records and receipts.
- Live/community features.
- Bible functionality.
- Library/e-learning foundation.
- Testimonies.
- Reading plans.
- Check-ins.
- Production deployment path.
- Supabase migration path.

The remaining work is mainly operational:

- Verify final Supabase `DATABASE_URL` on Render.
- Keep old Render database temporarily for rollback.
- Finalize production SMTP provider.
- Finalize production M-Pesa credentials.
- Finalize media storage credentials.
- Build and sign the final APK/AAB.
- Run real-device smoke tests.
- Prepare Play Store release.
