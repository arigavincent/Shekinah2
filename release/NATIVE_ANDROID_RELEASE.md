# Native Android release

The supported Android application is `android_app` (Kotlin/Compose). The Expo/EAS instructions in older project documents describe the retired client.

## Local verification build

Run PostgreSQL and MediaMTX with `docker compose up -d`, then start the API from `backend` with its existing `.env` loaded. The API applies migrations at startup. Use `NOTIFICATIONS_DELIVERY_ENABLED=false` during local broadcast tests to keep test announcements in the local feed without delivering external pushes.

```bash
cd android_app
./gradlew :app:assembleDebug :app:lintDebug
adb reverse tcp:3000 tcp:3000
adb reverse tcp:1935 tcp:1935
adb reverse tcp:8888 tcp:8888
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

`assembleQa` creates an optimized, signed QA APK with the development signing key. It uses `http://127.0.0.1:3000` by default; override with `-PqaApiBase=https://your-test-api`. This signing identity is for testing.

## Production build

Provide the ministry's actual API host and signing identity:

- `SHEKINAH_API_BASE` or `-PreleaseApiBase`: production HTTPS API origin.
- `SHEKINAH_KEYSTORE`: absolute path to the ministry-owned keystore.
- `SHEKINAH_STORE_PASSWORD`, `SHEKINAH_KEY_ALIAS`, `SHEKINAH_KEY_PASSWORD`: signing credentials.
- `-PversionCode=N`: increase monotonically for every distributed version.
- `-PversionName=X.Y.Z`: public version.

```bash
./gradlew :app:bundleRelease :app:assembleRelease -PversionCode=3 -PversionName=2.0.1
```

Release validation refuses to build against an absent/non-HTTPS host or without signing credentials. Keep the signing key and credentials outside source control and back them up under ministry ownership. The final production build, hosting, Play account, privacy/support URLs and distribution require the owner's real details.

## Live recordings

MediaMTX 1.21.2 records fMP4 segments into `.local/recordings/<session-id>/church`. The backend sets the recording path before publishing starts and requires MediaMTX's private control API. Set `LIVE_RECORDINGS_DIR` if the backend runs outside the repository's `backend` directory. The compose service uses UID/GID 1000; set `SHEKINAH_MEDIA_UID`/`SHEKINAH_MEDIA_GID` to match the backend user when different. Ensure the shared directory is writable by both services.

Install `ffmpeg` on the API host. Configure the existing `R2_ENDPOINT` (or `R2_ACCOUNT_ID`), `R2_SERMONS_BUCKET` (or `R2_BUCKET`), `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` and `LIBRARY_ENCRYPTION_KEY`. The encryption key must remain stable and backed up. The worker finalizes ended broadcasts, encrypts and authenticates the recording, uploads it (using multipart upload for recordings above 5 GiB), then marks the replay ready. Raw segments are removed only after upload and catalogue update succeed. PostgreSQL retains failed job/retry state. Replays check the original live purchase; staff access follows live permissions. Monitor free disk space and archive failures. Keep MediaMTX port 9997 private.

The API's plaintext replay cache is private server storage. It expires after 48 hours without access (`LIVE_REPLAY_CACHE_HOURS` overrides this) and evicts older files beyond 2 GiB; archived objects remain in R2. R2 archive objects are encrypted even when the bucket has a public hostname.

## Deferred service and content inputs

SMTP is intentionally deferred. Configure it before relying on password-reset emails or Serve email delivery.

Recorded Bible narration is integrated through the server, with device speech as the fallback. Set `BIBLE_BRAIN_KEY` and `BIBLE_BRAIN_FILESETS` to an explicit JSON mapping from installed translation IDs to licensed filesets and their required attribution:

```json
{"installed-version-id":{"fileset":"approved-fileset-id","attribution":"Required publisher attribution"}}
```

Do not map recordings merely by language: the recording must match the text translation. The API key stays server-side; chapter URLs and available verse timings are returned to the app. The production provider/key and selected translations still require a live acceptance test. Podcast import similarly requires the real feed configured in the existing podcast settings.

Use Admin > More > Ministry settings for official contacts, radio/TV links, app-download URL and giving instructions. Leave unknown details blank. Automatic M-Pesa checkout additionally requires `MPESA_CALLBACK_TOKEN`, supplied as a query capability in its callback URL; card checkout requires Flutterwave credentials and an actual redirect URL. Manual payments remain pending until finance verifies them.

## Web admin

Install dependencies with the committed `admin_dashboard/bun.lock` and run `bun run build` (Vite's application builder). Start the generated Node server with `BACKEND_API_BASE_URL=https://your-production-api`. By default the browser uses the admin's same-origin `/api/v1` proxy, which preserves authenticated JSON, multipart uploads, receipts and Range responses. `VITE_API_BASE_URL` can instead configure a direct browser API origin at build time. There is no fallback to the retired hardcoded Render host.


Expanded publishing (2026-10-28): native Ministry tools and web admin now support resumable single/batch media, PDF and event-poster queues. Shared defaults and per-item release times use Africa/Nairobi; history dates stay separate. Set notify off for backlogs. Web queues persist in IndexedDB and require the same browser profile/account to resume; phone sources use persistent document permissions and WorkManager. Supported limits: PDF 150 MiB, image 10 MiB, audio/video 5 GiB.

The API must have durable writable `UPLOAD_STAGING_DIR` storage (default `.local/upload-staging`, outside the public uploads directory), shared with every replica serving uploads. Unfinished staging expires after seven days. `R2_*` media storage and `LIBRARY_ENCRYPTION_KEY` remain required. Upload progress reaches 100% before the final server-to-R2 storage transfer completes.

New staff grants: `sermons:manage`, `events:manage`, `content:manage`, `community:moderate`, `finance:manage`. Grant through Team & Permissions; administrative settings and account grants remain admin-only. Content writes record their actor in `staff_actions`.

Ended MediaMTX recordings automatically appear under Sermons with a preparing state. Ready replay media always uses the private API gateway and the original live item ID for payment entitlement; live purchases include replay access. Paid external-form events retain a separate in-app ticket/payment gate; external responses are not synced.


Admin configuration: use the web dashboard **Settings** or phone admin **More → Ministry settings** for Spotify RSS, SMTP and production public URLs. SMTP credentials are encrypted in PostgreSQL with the server's existing key; preserve that key when deploying. Blank replacement passwords retain the current password. Connection checks negotiate/authenticate only and send no message. Saved settings take effect for new password-reset/Serve emails without restarting the API; environment SMTP is the fallback until an admin override is saved.

Production URL saving does not provision hosting/HTTPS/signing. Download `shekinah-release.properties` from the web Settings page, then build with `./gradlew :app:assembleRelease -PreleaseSettingsFile=/absolute/path/shekinah-release.properties` plus the ministry's signing environment variables documented above. A different API origin requires a new signed APK; an installed APK is not silently redirected.


### Web/native admin parity (October 2026)
The local admin dashboard uses the same gold, charcoal and blue brand as the native console. Users replaces Team & Permissions (old /team links redirect to /users). Publishing offers explicit Single/Batch selection, resumable transfers, per-item schedules, cover overrides and Free/Paid access. New PDFs render page one as their cover when no image is supplied. Install `poppler-utils` (`pdftoppm`) on the API host; missing/invalid renderers return an actionable publishing error and accept a manually supplied image. Originals remain encrypted and private.

Serve teams, requests and placements use /admin/serve; archiving a team preserves its request history. The web attendance page uses /attendance, matching native member codes and paid event tickets. Finance reports use /admin/giving/analytics and count only successful payments as income, separating currencies and donation/book/event/live/replay sources. Dates are Africa/Nairobi. Historical view/read analytics are not inferred from payments.

Browser broadcasting uses authenticated MediaMTX WHIP alongside native RTMP. Configure LIVE_WHIP_URL as the browser-reachable media origin (HTTPS outside localhost), and LIVE_WEBRTC_HOSTS in the Compose environment with reachable ICE host addresses. MediaMTX needs ports 8889/TCP and 8189/UDP (8189/TCP fallback). Browser capture needs HTTPS or localhost. Broadcasts negotiate H.264 for recording compatibility. Ending a service disconnects both RTMP and WebRTC publishers, then follows the existing encrypted R2 archive pipeline and original paid entitlement. Reference: https://mediamtx.org/docs/publish/web-browsers and https://mediamtx.org/docs/features/webrtc-specific-features .

## Current admin integrations and studio

Web **Settings → External integrations** manages M-Pesa Daraja (sandbox/production, consumer credentials, merchant shortcode/passkey, callback protection), Flutterwave, Bible Brain translation filesets, API.Bible, optional Cloudflare Stream/Cloudinary, and Firebase server credentials. Spotify RSS, SMTP and production URLs remain in their existing sections. Secrets are encrypted and masked; blank secret replacements retain saved values, and clearing a secret requires an explicit choice. Saved provider settings apply to new requests without restarting. Connection checks authenticate or validate format and never send a payment prompt, email, push or upload.

M-Pesa callbacks must reach `/api/v1/giving/mpesa/callback` over public HTTPS. The app attaches callback protection to each submitted checkout and pins verification for that checkout across token changes. Automatic payments require a client request ID, use server-side item prices and retain original live/replay entitlements. Duplicate requests return the same transaction. A protected intent reference lets a validated callback recover a lost STK submission response, and a late submission acknowledgement cannot downgrade an already-confirmed payment. Current app prices and card checkout use KES. Real merchant and callback acceptance requires the actual provider account and a controlled live test after deployment; a passing OAuth check alone does not prove settlement. SMTP remains deferred until its real settings are provided.

Phone and web single/batch upload queues expose **Publish now** and **Schedule for later**, with calendar/clock controls. Files upload immediately in either mode; future publication runs on the server. History/service dates are independent. Browser broadcasting needs HTTPS or localhost and H.264 support. It now composites camera, shared screen/sound, PDF/image slides, picture-in-picture, scripture, break screen and branding into the stream. Camera effects and digital zoom work in the compositor; torch depends on camera/browser support. Closing the studio releases capture and ends only its own reserved session.

## Prepared signing identity and artifacts

The first ministry release key is stored outside the repository at `~/.local/share/shekinah-release/shekinah-ministry.p12`; its private environment file is `~/.local/share/shekinah-release/signing.env`. A second copy is in `~/Documents/Shekinah Release Backup`. Both directories are private to the account. Copy that backup to ministry-owned offline storage before public distribution. Keep the same signing identity for future APK updates.

Certificate SHA-256: `5D:28:C2:E2:37:0F:93:4D:8B:A6:9B:1D:CD:52:2B:64:B1:D8:45:4F:91:87:84:48:2B:52:BB:F5:EA:C2:69:4E`.

Run `./release/prepare-artifacts.sh` to build the Linux AMD64 API/migrations archive, Node admin archive and local optimized QA APK, with checksums in `release/artifacts`. API hosting also needs `ffmpeg`, `pdftoppm` (poppler-utils), PostgreSQL and durable staging/recording storage; the binary archive does not include these services. The admin archive runs with Node 24 and `BACKEND_API_BASE_URL` pointing to the API.

To produce the final ministry-signed APK/AAB after the real API domain exists:

```bash
source "$HOME/.local/share/shekinah-release/signing.env"
export SHEKINAH_API_BASE='https://YOUR-ACTUAL-API-DOMAIN'
export SHEKINAH_VERSION_CODE=3
./release/prepare-artifacts.sh
```

The local QA APK keeps the development certificate and localhost endpoint so it can update the current test installation without erasing its session. A production APK signed with the ministry key has a different signing identity; plan the switch from the development installation separately, preserving server-side accounts and purchases.

Production startup refuses a weak server key, a missing/invalid 32-byte library encryption root, or active historical demo accounts still using the demonstration password. The check does not reset or deactivate accounts. Resolve those account records deliberately before bringing production online. Preserve encryption roots and database backups; changing the server key without migrating encrypted provider/SMTP settings makes those settings unreadable.
