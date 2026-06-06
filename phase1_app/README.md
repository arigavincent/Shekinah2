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
npm run start
```

## Build Debug APK

Use Java 21, not the system Java 25:

```bash
cd /home/ariga/shekinah_final/phase1_app/android
JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 PATH=/usr/lib/jvm/java-21-openjdk-amd64/bin:$PATH ./gradlew :app:assembleDebug --no-daemon --console=plain
```

## Current Phase 1 Limitations

- Uses local sample content only.
- Sermon/devotion/event images are backend placeholders.
- Branch details, service times, phone numbers, About text, and Vision text are backend placeholders.
- Remote images are loaded from external URLs.
- No real backend yet.
- No real M-Pesa STK Push yet.
- No real OneSignal push setup yet.
- No real offline downloads yet.
- No production signing keystore yet.
- The APK is a debug APK, suitable for testing, not Play Store release.
