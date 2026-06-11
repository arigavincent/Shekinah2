# Android Release Runbook

## 1. Freeze inputs

- Confirm production API base URL
- Confirm production database and backups
- Confirm OneSignal app id and keys
- Confirm Daraja production or sandbox credentials for the target build
- Confirm Flutterwave keys and redirect URL
- Confirm church media, branch contacts, and about text

## 2. Build configuration

- Set `EXPO_PUBLIC_API_BASE_URL` to the production API
- Set backend env vars:
  - `DATABASE_URL`
  - `JWT_SECRET`
  - `ALLOWED_ORIGINS`
  - `MPESA_*`
  - `FLUTTERWAVE_*`
  - `API_BIBLE_*` if using direct provider credentials later
- Verify admin dashboard `VITE_API_BASE_URL`

## 3. Android signing

- Confirm keystore ownership
- Confirm alias name and passwords
- Store secrets outside the repo
- Record who owns the signing material

## 4. Build steps

### Mobile app

From `phase1_app/`:

```bash
npx expo export --platform android
```

For signed release builds, use the team’s chosen EAS or native Android pipeline.

### Admin dashboard

From `admin_dashboard/`:

```bash
npm run build
```

### Backend

From `backend/`:

```bash
go test ./...
```

Deploy the backend only after migrations pass against the target database.

## 5. Pre-release smoke test

Test on a real Android device:

- app launch
- login / register
- home feed
- video/audio playback
- live stream
- downloads and offline reopen
- Bible reader
- Bible version install
- prayer wall
- community chat
- testimonies
- reading plans
- QR check-in member code
- giving with M-Pesa
- card checkout
- push notifications

## 6. Go / no-go checks

Do not ship if any of these fail:

- app crashes on launch
- auth loop or expired-token lockout
- backend health or migrations fail
- sermon playback fails
- giving flow cannot create a transaction
- push registration fails on signed build
- admin dashboard cannot moderate prayer/chat/testimony queues

## 7. Rollout

- Upload signed artifact
- Start with internal or closed testing
- Verify backend logs during first installs
- Verify giving transaction creation and notifications on live traffic
- Roll out gradually before full production release
