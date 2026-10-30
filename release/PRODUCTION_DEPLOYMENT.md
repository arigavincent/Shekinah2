# Shekinah deployment — 30 October 2026

The API and web admin are live together on the existing free Render service:
https://shekinah-sons-backend.onrender.com

Admin sign-in: https://shekinah-sons-backend.onrender.com/login
API health: https://shekinah-sons-backend.onrender.com/api/v1/healthz

## Android release

`artifacts/shekinah-production.apk` is the installable ministry-signed Android release, version 2.0.2 (version code 3). Its compiled API base is the HTTPS Render origin above; the localhost development API is absent. The same verified APK was installed on the TECNO, replacing the differently signed development build with the owner's explicit approval. A copy is also in the phone's Downloads folder as `Shekinah-2.0.2.apk`.

Signing certificate SHA-256:
`5D:28:C2:E2:37:0F:93:4D:8B:A6:9B:1D:CD:52:2B:64:B1:D8:45:4F:91:87:84:48:2B:52:BB:F5:EA:C2:69:4E`

The signing identity and its backup remain outside the repository. Preserve them for future Android updates. Artifact hashes are in `artifacts/SHA256SUMS`.

## Infrastructure and data

- Existing backend service: free Docker runtime, one public Node admin process plus the Go API on loopback. The old suspended admin service and unrelated services were left alone.
- Render PostgreSQL 17: free trial expires **29 November 2026**. Export or migrate before expiry to preserve production accounts and purchases. This is not permanent free database hosting.
- Existing accounts, content and purchases were copied using an authenticated encrypted bootstrap into an empty database. Existing data was never overwritten. Known demonstration-password accounts were disabled only in the production copy; the owner's admin account was retained.
- Persistent library encryption root was retained. Provider/SMTP settings were resealed for the strong production server secret. One-time bootstrap environment inputs were removed after the successful restore.
- Original local-only Gifted Hands PDF and cover were migrated to R2, retaining their library item ID and metadata; production download matched the original SHA-256.
- Automatic Git/Blueprint deployment is paused; both configurations point to the dedicated release branch. Deploy intentionally after validating future changes.

## Streaming and verification

Free hosting uses encrypted native/browser video segments uploaded directly to R2. Render handles authorization, upload acknowledgments, manifests and encryption keys. Server transcoding, RTMP hosting and UDP ports are not required for this path. The original MediaMTX path remains available for a separately supported host.

Verified: production API/database health and original admin login; decrypted runtime integration settings; dashboard rendering at desktop and 390px widths without script exceptions or overflow; real upload from the deployed dashboard origin through the configured R2 CORS policy; encrypted-object acknowledgment; paid anonymous manifest/key denial; automatic replay publication and encrypted H264/Opus playback; durable browser interruption/reload recovery. Native synthetic H264/AAC segment encoding and ExoPlayer encrypted R2 replay playback passed on the phone before release packaging. The installed production app loaded its real home data from Render.

Disposable-database regression tests cover original live-purchase replay entitlements, roles, segment ordering, duplicate acknowledgments, late uploads, restart recovery and quota enforcement. Full Go, TypeScript, production web, Android release and release lint checks passed. A Chrome initialization edge case was reproduced and fixed with a regression test.

No live financial charge, test email or external test push was sent. Normal future application notification delivery is enabled.

## Remaining inputs and acceptance

SMTP remains deferred. Actual Spotify podcast RSS, merchant/payment and other provider credentials are configurable in web Settings or the phone admin console. Provider account authentication does not replace a controlled real-payment callback/settlement test. Native forced reconnect, complete cold-start notification tap-through and a full release-device live broadcast remain broader acceptance checks; do not infer them from encoder/player tests.

Manual security/dependency review was performed. The requested official Claude Security workflow could not run because its required Workflow tool was unavailable. No successful official scan is claimed. Cloudflare object upload/CORS checks passed; broader account/zone WAF/DNS inspection was not available with the object-storage credential.

Keep secret files, database dumps, private signing material and `.local` acceptance logs out of source control.
