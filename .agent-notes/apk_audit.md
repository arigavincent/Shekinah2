# APK completion audit — 2026-10-28

Scope: existing Kotlin APK, member/admin workflows, Go API, web-admin parity and release validation. User explicitly deferred SMTP. This audit changes no product behavior.

## Confirmed release blockers

1. **Critical: payment confirmation bypass.** server.go exposes public mock-complete and card-return handlers. MockComplete updates any matching transaction to success; CardReturn also trusts request status instead of provider verification. Local QA probe: paid book 402 before anonymous mock-completion, 200/PDF afterward. QA transaction removed immediately afterward.
2. **High: transaction privacy.** Public transaction details and invoice endpoints returned 200 without authentication for the QA purchase. Add owner/admin authorization and a deliberate secure mechanism for any guest-giving receipt access.
3. **Android compatibility.** assembleRelease completed, producing 20.5 MiB app-release-unsigned.apk, versionCode 1. lintDebug failed with 3 NewApi errors: Broadcast.kt:173 MixAudioSource mute/unMute require API29; GateScreen.kt:374 MediaStore.Downloads requires API29; minSdk is 26. Remaining warnings include dependency updates and third-party TLS implementation warnings, which are not by themselves proof of app exploitability.
4. **Delivery configuration.** No native release signing configured. API_BASE hardcodes the old Render endpoint; live defaults remain localhost. Existing release runbooks still describe Expo/EAS rather than the Kotlin release.

## Confirmed functional gaps

- **Offline books:** Books.list always calls API; LibraryScreen stores catalogue only in remember state. Encrypted copies exist, but after cold restart with only API ADB reverse removed, shelf shows No connection / The shelf is being filled. Restoring reverse and retry restores catalogue. Phone internet/hotspot untouched.
- **Downloads:** Library.download uses an in-process IO coroutine and swallows failure; no durable task state, retry UI, pause/cancel or restart recovery. VaultFiles keeps .part on failure and ignores rename success. Large/HLS downloads need explicit format handling and storage accounting.
- **Private local data:** paid-book vault IDs/progress are account-scoped, but Reader marks use book.id only. Bible notes/highlights and sermon saves/history use device-wide prefs. Separate personal data by account and migrate existing data deliberately.
- **Live recordings:** legacy Cloudflare Stream importLiveRecordings exists, but the current in-app MediaMTX path has no recording configuration or recording-to-R2 ingestion. Add recording/finalization/upload/retry/catalogue workflow, preserving paid replay entitlement.
- **Password consistency:** registration accepts 8 characters, change-password API requires 12, while native UI enables it at 8. Native Member omits passwordResetRequired, so forced-reset flow lacks an explicit native gate. Review expiry, disabled accounts and token invalidation after credential changes.
- **Events:** RegistrationForm sets busy=true but never resets it after parent API failure; EventDetail refreshes only on local state changes, not when pending payments are approved remotely. Add retry/recovery and confirmation refresh.
- **Reading plans:** all PlanReminder alarms share request code 31 and cancel each other; no boot receiver reschedules reminders. Plan enrollment/streak calculations mix server-local/UTC dates rather than a consistent church/member day.
- **Notifications:** taps open MainActivity without routing data; no content deep-link handler. Publishing a sermon/devotion/event currently does not itself invoke notification delivery; admin can broadcast manually. Recent announcements UI uses content.updates rather than actual delivered notification history.
- **Community:** only latest 80 messages are loaded, no older-history cursor; incremental fetch only adds unseen messages, so moderation changes to existing items are not synchronized. No native global-chat moderation/reporting workflow; web moderation exists.
- **Admin parity:** native console covers finance review, permissions, books, events, Serve, branches, prayer follow-up and notification broadcast. Sermon/devotion/update/reading-plan authoring and testimony/global-chat moderation remain web-only. Web library editor still has legacy fileUrl fields without paid-book price/publishing controls. Define intentional parity and sync contracts.
- **Content and links:** Home labels June 4 content Today's Devotional on Oct 28. Giving explicitly uses demo details. Radio/TV links are empty; Official Website points to example.com. About contact text has no actual contacts. Share app/event text has no install/event URL.
- **Audio integrations:** local podcast_feed_url is absent; current sermons are manual (4 audio, 10 video). Narrator still uses device TTS and no Bible Brain integration is implemented in native/backend source. External provider key/feed remains needed for final real-data checks.

## Verified existing behavior

- All five root tabs load; Video/Audio/Recaps catalogue, bundled Bible and comparison features are present, Devotions and Live offline state load.
- Existing encrypted audio download is visible in Downloads. Books shelf restores after API reconnect.
- Events, community chat, prayer wall, testimonies, notifications/settings, platforms and About screens load. Giving shows manual provider cards and transaction history.
- Earlier pass confirmed QR camera scanning, duplicate prevention, permission checks, attendance table and PDF export; fixed long-text truncation in PDF.
- Earlier full backend suite passed, including isolated database/email sink checks for Serve, password reset, plans, branches and multipage attendance.
- Live broadcast, screen share, overlays and moderation had earlier recorded tests; mute/camera/torch/zoom/PDF slides, reconnect and lifecycle matrix still need acceptance testing.

## Proposed implementation order

1. Payment/receipt authorization and trusted settlement; regression tests prove pending payments cannot unlock content.
2. Offline catalogue, account-local privacy and durable download recovery.
3. Live recording/archive pipeline and host/viewer lifecycle tests.
4. Account/password consistency, events retry/payment refresh, reminder isolation/reboot and notification routing.
5. Admin workflow parity, publishing notifications and global-community history/moderation.
6. Content/link cleanup and UI/accessibility refinements: date-aware devotion labels, consistent spacing/cards/error states, labelled fields, password visibility, font scaling and meaningful empty states.
7. Fix compatibility lint errors, configure release environments/signing, update native runbooks, and run member/admin/publisher/moderator/usher acceptance matrix on release build.

External setup tracked separately: SMTP deferred; human-narration provider key, podcast feed, real paybill/bank/branch/platform/contact data, production host and signing ownership. Avoid introducing unrelated feature expansion as a prerequisite for finishing existing promises.
