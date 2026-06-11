# Phase 3 Production Checklist

Use this checklist before producing the final APK/AAB and opening the app to members.

## Content Approval

- Replace all placeholder sermon, devotion, event, branch, update, platform, and about text.
- Replace all Unsplash/sample images with approved church media.
- Review `docs/production/PLACEHOLDER_AUDIT.md`.
- Complete `docs/production/CONTENT_INVENTORY.md`.
- Confirm real branch names, addresses, phone numbers, service times, and GPS coordinates.
- Confirm official Vision, About, and Contact copy.
- Confirm YouTube live stream ID and past-service strategy.

## Backend Configuration

- Complete `docs/production/CREDENTIALS_INVENTORY.md`.
- Set a strong production `JWT_SECRET`.
- Change the seeded admin password immediately after first login.
- Disable or replace any temporary admin account not needed in production.
- Configure production database backups.
- Confirm Render backend health check passes at `/healthz`.
- Confirm migrations run successfully on a fresh production database.

## Admin Dashboard

- Deploy the admin dashboard with `VITE_API_BASE_URL` pointing to the production backend.
- Confirm admin login works only after password reset.
- Confirm create/update/delete flows for sermons, devotions, events, branches, updates, live config, giving records, and notifications.
- Confirm uploaded media URLs display correctly inside the mobile app.

## Mobile App Environment

- Set `EXPO_PUBLIC_API_BASE_URL` to the production backend URL before release builds.
- Confirm Expo Go testing against production/staging API.
- Confirm Android package name: `com.shekinahsons.globalapp`.
- Confirm version and `versionCode` for the release.
- Confirm app icon, adaptive icon, splash screen, and logo are final.

## Notifications

- Configure OneSignal or final push provider credentials.
- Confirm Expo push token registration from a real Android device.
- Confirm notification preferences save.
- Send test notifications for sermons, devotions, live service alerts, events, and prayer updates.
- Confirm notification tap targets open the correct mobile screen.

## Giving

- Configure M-Pesa Daraja production credentials.
- Confirm callback URL is public and uses HTTPS.
- Test successful STK push payment with a real Safaricom number.
- Test failed, cancelled, and timed-out payments.
- Configure card processor credentials if Visa/Mastercard is going live.
- Confirm giving history and statements match backend records.

## Media and Storage

- Configure Cloudinary or final media storage provider.
- Confirm image upload, audio upload, and video URL entry from admin.
- Confirm large sermon media files stream reliably on mobile data.
- Confirm offline downloads are stored and deleted correctly on Android.

## Bible

- Confirm bundled English and Kiswahili Bible database works offline.
- Confirm any additional Bible version provider licensing/API terms.
- Test bookmarks, highlights, and downloaded versions offline.

## Legal and Release

- Prepare privacy policy.
- Prepare terms/contact support details.
- Prepare Play Store listing copy, screenshots, feature graphic, and app category.
- Create production signing keystore and store it securely.
- Build final Android release artifact.
- Run installation and smoke tests on at least two Android devices.
