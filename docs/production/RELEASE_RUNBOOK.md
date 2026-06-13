# Android Release Runbook

For Render sandbox deployment before mobile release, use:

- [`RENDER_SANDBOX_DEPLOY.md`](./RENDER_SANDBOX_DEPLOY.md)

## 1. Prepare Production Data

1. Complete `docs/production/CONTENT_INVENTORY.md`.
2. Upload approved images/audio/video through the admin dashboard.
3. Replace seeded placeholder content.
4. Confirm `/api/v1/home` shows production content.

## 2. Configure Production Backend

1. Deploy with `render.yaml`.
2. Set all secrets from `docs/production/CREDENTIALS_INVENTORY.md`.
3. Confirm backend health:

```bash
curl https://shekinah-sons-backend.onrender.com/healthz
```

4. Login to admin using the seeded account, reset the password, then replace or disable any temporary account.

## 3. Configure Admin Dashboard

1. Confirm `VITE_API_BASE_URL` points to the production backend.
2. Open admin dashboard.
3. Test create/update/delete for sermons, devotions, events, branches, updates, live config, and notifications.

## 4. Configure Mobile Environment

Create `phase1_app/.env` from `.env.production.example`:

```text
EXPO_PUBLIC_API_BASE_URL=https://shekinah-sons-backend.onrender.com
```

Run a production API smoke export:

```bash
cd phase1_app
npx expo export --platform android --output-dir /tmp/shekinah-production-export
```

## 5. Build Preview APK

```bash
cd phase1_app
npm run build:android:preview
```

Install the APK on real devices and test:

- App launch.
- Home content.
- Sermons playback.
- Audio player and mini-player.
- Devotions.
- Bible offline.
- Events.
- Giving sandbox/production mode.
- Notifications.
- Branch directions.

## 6. Build Production AAB

```bash
cd phase1_app
npm run build:android:production
```

## 7. Play Store Internal Test

1. Upload the AAB to Play Console internal testing.
2. Add testers.
3. Install from Play Store internal link.
4. Run smoke tests again.

## 8. Release Decision

Do not promote beyond internal testing until:

- Real payments have been verified.
- Notification opt-in and delivery are verified.
- Production content is approved.
- Privacy policy URL is live.
- Support contact is monitored.
