# Phase 3 Downloads and Offline Audit

Audit date: 2026-06-10

Scope:
- sermon downloads
- downloads manager
- offline Bible
- playback persistence
- account sync readiness

## Summary

The app already has a real local-device foundation for offline use:

- audio sermon downloads exist
- direct video sermon downloads exist
- bundled offline Bible exists
- local download manifest exists
- downloaded items can be reopened from the Downloads screen

But the current implementation is still local-only and incomplete relative to the product plan:

- no backend-linked download records
- no synced watch/listen progress
- no downloadable extra Bible versions
- no real Bible bookmarks/highlights persistence model beyond simple local favorites
- no durable offline queue/retry behavior

This means the feature area is good enough for Phase 3 implementation work, but not finished enough to treat as production-complete.

## What Is Already Real

### 1. Local download manifest

The mobile app stores downloads in the device file system and tracks them in a local manifest:

- [phase1_app/src/services/downloadsStore.js](/home/ariga/shekinah_final/phase1_app/src/services/downloadsStore.js:1)

Current behavior:
- creates a local downloads root directory
- stores a `manifest.json`
- lists valid files only
- removes missing-file entries automatically
- supports register and delete

This is a real implementation, not placeholder UI.

### 2. Audio download flow

The audio player supports real file download and offline reopen:

- [phase1_app/src/screens/AudioPlayer.js](/home/ariga/shekinah_final/phase1_app/src/screens/AudioPlayer.js:99)

Current behavior:
- resolves backend media URL
- downloads to local storage with Expo FileSystem
- registers the file in the manifest
- reopens from Downloads using the local file URI

### 3. Direct video download flow

The video detail screen supports real direct-file download:

- [phase1_app/src/screens/VideoDetail.js](/home/ariga/shekinah_final/phase1_app/src/screens/VideoDetail.js:78)

Current behavior:
- detects direct uploaded video files
- downloads to local storage
- registers the file in the manifest
- reopens from Downloads using the local file URI

Limitation:
- YouTube videos are correctly not downloadable in-app

### 4. Downloads screen

There is a real Downloads Manager screen:

- [phase1_app/src/screens/DownloadsScreen.js](/home/ariga/shekinah_final/phase1_app/src/screens/DownloadsScreen.js:99)

Current behavior:
- shows local sermon downloads
- computes total bytes from actual files
- deletes downloads from device
- reopens downloaded audio/video content

### 5. Offline Bible foundation

The Bible is already bundled as a local SQLite database:

- [phase1_app/src/screens/BibleScreen.js](/home/ariga/shekinah_final/phase1_app/src/screens/BibleScreen.js:12)

Current behavior:
- ships with `bible.db`
- copies DB to app storage on first run
- queries books/chapters/verses from SQLite
- supports local text search
- works offline once bundled DB is present

This is the strongest offline feature already in the app.

## Partial or Misleading Areas

### 1. Backend `downloads` data is not the real downloads system

The backend home payload exposes `downloads`, but that table is just content data, not device download state:

- [backend/internal/content/model.go](/home/ariga/shekinah_final/backend/internal/content/model.go:14)
- [backend/internal/content/repository.go](/home/ariga/shekinah_final/backend/internal/content/repository.go:425)
- [backend/migrations/202606040003_add_remaining_phase1_content.sql](/home/ariga/shekinah_final/backend/migrations/202606040003_add_remaining_phase1_content.sql:10)

Problem:
- backend `downloads` only stores `id`, `title`, `size`, `image_url`
- it does not represent real member downloads
- it is not tied to users, local files, or sync state

Conclusion:
- current device downloads are local only
- backend download records from the original plan are not implemented

### 2. Bible Versions tab is mostly placeholder

The Downloads screen presents a Bible Versions tab, but only bundled English is surfaced there:

- [phase1_app/src/screens/DownloadsScreen.js](/home/ariga/shekinah_final/phase1_app/src/screens/DownloadsScreen.js:54)

Problem:
- no downloadable extra versions
- no version catalog
- no version file storage flow
- no delete flow for additional versions

The UI correctly says more versions are coming later, which matches the code.

### 3. Bible persistence is shallow

Bible favorites are stored locally in a narrow way:

- [phase1_app/src/screens/BibleScreen.js](/home/ariga/shekinah_final/phase1_app/src/screens/BibleScreen.js:18)
- [phase1_app/src/screens/BibleScreen.js](/home/ariga/shekinah_final/phase1_app/src/screens/BibleScreen.js:202)

There is also a broader storage helper:

- [phase1_app/src/services/bibleStorage.js](/home/ariga/shekinah_final/phase1_app/src/services/bibleStorage.js:1)

Problem:
- `BibleScreen` uses `FAVORITES_KEY` directly
- `bibleStorage.js` is not wired into the Bible screen
- highlights/notes/recent are not actually connected to the reader UI

Conclusion:
- offline Bible reading works
- offline Bible state management is only partly implemented

### 4. Playback progress is not persisted

Audio playback state is in-memory only:

- [phase1_app/src/services/audioPlayback.js](/home/ariga/shekinah_final/phase1_app/src/services/audioPlayback.js:1)

Problem:
- no AsyncStorage persistence for playback position
- no periodic save every 30 seconds
- no backend sync of watch/listen progress
- no resume markers in Home/Sermons based on persisted state

This is a direct gap against the plan.

### 5. Download metadata is local-only and weakly typed

The local manifest is useful, but it is still a thin metadata store:

- [phase1_app/src/services/downloadsStore.js](/home/ariga/shekinah_final/phase1_app/src/services/downloadsStore.js:63)

Problem:
- no explicit download status lifecycle
- no partial/incomplete recovery state
- no checksum or corruption check
- no retry queue
- no per-user separation on shared devices

## Missing Against the Plan

### 1. Extra Bible version downloads

Not implemented:
- provider search
- download/install flow
- selector for installed extra versions
- delete flow for installed extra versions

### 2. Synced download records

Not implemented:
- member-linked downloaded sermon metadata in backend
- backend awareness of downloaded Bible versions
- cross-device sync for downloaded state

### 3. Watch/listen history

Not implemented:
- 30-second progress saves
- resume state across app launches
- continue labels and thumbnail progress bars tied to persisted state

### 4. Real Bible bookmarks/highlights/notes model

Not implemented:
- verse-level bookmarks synced or even fully local-structured in active UI
- highlight colors
- notes UI
- backend sync

## Practical Readiness

### Ready to build now

- downloads manager polish
- offline audio/video reopen flow improvements
- storage usage improvements
- delete/download consistency improvements
- Bible version architecture for local install

### Not ready to claim complete

- account-synced offline system
- full reading-progress sync
- downloadable Bible versions
- polished offline QA across restarts, network loss, and broken files

## Recommended Build Order

1. Tighten sermon download lifecycle
2. Add playback progress persistence locally
3. Surface continue/resume state in Sermons and Home
4. Add downloadable Bible version architecture
5. Unify Bible local storage through one service
6. Only then add backend sync for account-linked state

## Immediate Implementation Target

The next implementation pass should cover:

- stable local download records
- offline reopen after full app restart
- local playback resume persistence
- accurate Downloads screen states
- groundwork for extra Bible versions

That is the correct next step before heavier Phase 3 features like testimonies, chat, or reading plans.
