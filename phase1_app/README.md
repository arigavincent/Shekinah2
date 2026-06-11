# Shekinah Sons Global - Phase 1 App

This is the first Phase 1 Android APK implementation for the Shekinah Sons Global church app.

## What Is Included

- Dark Shekinah visual system: black, gold, deep blue, white, grey
- Real Shekinah Sons Global logo wired into the app
- Logo-based app icon, adaptive icon, and splash assets
- Home screen with devotional, scripture card, sermon rows, clips, and events
- Bottom tabs: Home, Sermons, Devotions, Live
- Left side drawer with secondary screens
- Global search across local sample content
- Sermons screen with Video, Audio, Categories, Highlights tabs
- Video sermon detail
- Full-screen audio player with persistent mini-player
- Devotions and local favourite state
- Live stream state screen
- Downloads manager mock
- Branches with Google Maps deep link
- Profile and settings mock
- Bible reader shell
- Events and event detail
- Giving mock flow
- Prayer Wall preview
- Updates
- Platforms
- Serve form mock
- Notification preferences mock
- About and contact screen
- Backend-ready placeholder content in `src/content.js`

## Expo Go Testing

The current Phase 1 build should be tested in Expo Go before producing a release APK.

```bash
cd /home/ariga/shekinah_final/phase1_app
npx expo start --host lan --clear --port 8081
```

Current Expo URL while the dev server is running:

```text
exp://192.168.1.69:8081
```

## APK

Built APK:

```text
/home/ariga/shekinah_final/ShekinahSonsGlobal-phase1-debug.apk
```

Original Gradle output:

```text
/home/ariga/shekinah_final/phase1_app/android/app/build/outputs/apk/debug/app-debug.apk
```

## Run Locally

```bash
cd /home/ariga/shekinah_final/phase1_app
npm run start:lan
```

## API Environment Profiles

Use one of the checked-in examples as the source for your local `.env`:

```text
.env.development.example
.env.staging.example
.env.production.example
```

For Expo Go on a physical phone, `EXPO_PUBLIC_API_BASE_URL` must use your laptop LAN IP, not `localhost`.

## Build Debug APK

Use Java 21, not the system Java 25:

```bash
cd /home/ariga/shekinah_final/phase1_app/android
JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 PATH=/usr/lib/jvm/java-21-openjdk-amd64/bin:$PATH ./gradlew :app:assembleDebug --no-daemon --console=plain
```

## EAS Release Builds

Preview APK:

```bash
npm run build:android:preview
```

Production Play Store bundle:

```bash
npm run build:android:production
```

Before production builds, copy `.env.production.example` to `.env` and set `EXPO_PUBLIC_API_BASE_URL` to the production backend.

## Remaining Production Work

- Replace placeholder backend content with approved church content.
- Configure real M-Pesa, push notification, media storage, maps, and Bible provider credentials.
- Create the production signing keystore before Play Store release.
