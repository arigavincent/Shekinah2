# Implement full APK finish plan

## Latest hosting constraint — 2026-10-30

User explicitly requires zero paid deployment plans: prefer Render Free with existing Cloudflare R2 Standard free allowance (10 GB-month); Railway Free is an alternative only if it fits free usage. This supersedes earlier VPS/AWS/paid Render recommendations. No paid service, disk, upgrade, domain purchase or usage overage is authorized. Preserve live streaming, automatic recording and paid-content requirements; do not silently defer or claim those are deployable unchanged. Current direct RTMP/WebRTC media server and local-disk archive assumptions still need a free-host-compatible implementation and verification. Recordings/books/accounts/purchases must be preserved. The existing Render blueprint remains incomplete; selecting free plans does not make it deployment-ready.

User authorized all seven passes on 2026-10-28. SMTP is deferred. Prior audit and handoff work remain intact.

- [x] 1. Secure payments, receipts, settlement and session/account behavior with regression tests.
- [x] 2. Persist offline book catalogue; isolate account data; implement durable download recovery/control.
- [ ] 3. Add MediaMTX recording-to-R2 archive flow and paid replay protection; verify live controls.
- [ ] 4. Fix account/event/reminder flows and notification routing.
- [x] 5. Finish admin authoring/moderation parity, publishing notifications and community history.
- [x] 6. Refine content freshness, links, forms, accessibility and lifecycle refresh.
- [ ] 7. Fix compatibility checks; configure release/signing; build/install and verify roles/workflows.

Constraints: keep phone hotspot/connectivity intact; no external messages or paid services. Real SMTP/provider/ministry credentials are external inputs, not grounds to stop independent implementation. Do not invent official contact/payment details or publish to production.

## Current verification remaining

Native admin authoring/moderation screens, dependency advisory remediation, final signed APK installation and regression pass completed. Notification routing has been implemented; a final on-device tap-through remains outstanding. Recording to real R2 and native replay playback passed; broad live controls still need a final spot check. External inputs stay deferred (SMTP; licensed narration key/filesets; official feed/details/production host/signing).

## Previous audit (completed)

User request: inspect the whole APK, identify unfinished work and refinements, and provide a finish plan before implementation. SMTP is explicitly deferred.

- [x] Inventory every member/admin screen and its server dependencies.
- [x] Review feature behavior, access control, downloads, live lifecycle, and release configuration.
- [x] Inspect the APK on the connected phone and run focused build/validation checks.
- [x] Produce a prioritized plan separating confirmed defects, verification gaps, refinements and external setup.

Preserve all existing work. Do not change product behavior during the audit. Keep phone connectivity intact; no paid services or external messages.

## Previous handoff verification (completed)

- [x] Restore local backend, database, media server and USB access.
- [x] Verify repaired QR scan, permissions, duplicate attendance and PDF export on the phone.
- [x] Verify Serve requests, password reset, branches and reading plans; fix demonstrated problems.
- [x] Run appropriate checks and report confirmed results and external dependencies.

Remaining external setup: real SMTP settings; Bible Brain narration key; production hosting and real ministry details. Broader live-control phone tests remain outside this verification pass.

Constraints: Keep the phone hotspot and connectivity intact. Use local services. Do not expose credentials. Do not send email to others without explicit authorization. Production deployment and paid services are outside this local testing pass.


## Expanded requirements requested after APK handoff

User requests a consolidated plan first, covering the four finishing checks plus:
- Single and batch native-phone/web publishing for sermons, books/materials, and event records/posters.
- Separate historical service/event dates (including at least two months of backlog), upload timestamps, and scheduled publication dates/times; Africa/Nairobi default. Batch defaults, per-item overrides, recurring release spacing, preview, durable upload queue and duplicate detection.
- Retain Claude requirements: custom in-app event registration forms or external Google Forms links; free/priced events and books; only explicitly authorized publishers/broadcasters; unified item-bound payment verification and private in-app reading/downloads.
- Extend current four permissions with scoped sermon/event management and finance/content moderation capabilities, enforced server-side and reflected in member/staff/admin UI.
- Spotify show podcast RSS enclosures supply full audio to Shekinah's own player; actual show/feed input required. Sync past episodes and periodic updates without duplicates.
- Existing R2 archive/replay path must also publish recordings into Sermons automatically. Retain original broadcast purchase entitlement, so live purchasers can replay without paying twice and nonpayers must purchase access. Attendance is not an entitlement. Show preparing state until media is ready; minimize delay with incremental recording/upload.
- Finish live-control acceptance, background notification/reminder checks, optimized-APK role/error-flow acceptance, and QA cleanup/final build.

Scope control: implement and verify these requirements in phases; do not add unrelated redesigns or optional features. SMTP remains deferred. Never disrupt the phone hotspot or send external notifications during local tests.

## Active expanded implementation — approved
- [x] A. Scoped staff permissions and audit; draft/scheduled publication with Nairobi times and quiet backlog imports.
- [x] B. Durable single/batch phone and web publishing, defaults/per-item review, retries and duplicate protection.
- [x] C. Automatic Sermons catalogue replays with original live entitlements; RSS sync acceptance.
- [ ] D. Native/web regression, connected-phone checks, optimized APK installation and cleanup.

External setup stays deferred as above. Preserve all prior working changes.

Expanded implementation verification: Go regression suite, TypeScript, production web build, debug/optimized Android builds and lint pass. Native video/PDF queue completion and process recovery verified; browser pause/reload/resume and R2 completion verified. A real muted phone broadcast archived to R2, appeared automatically in Sermons, and played through the private gateway in the native player (seek position advanced). Preview mic/camera toggles, camera flip, banner/logo and torch exercised. Foreground/background Firebase delivery to this device verified; closed-app attempt failed during provider/network access. Slides/zoom and forced reconnect acceptance remain unverified. No reboot or hotspot changes performed. Original session restored and QA grants/content/storage cleaned. Actual Spotify feed, deferred SMTP and production details/signing remain external setup.

## Current task — admin configuration and dashboard access
- [x] Secure runtime SMTP settings, masked/encrypted credentials and connection check; mail callers use saved settings.
- [x] Central web Settings for Spotify RSS, SMTP and production public URLs; phone admin parity.
- [x] Validate runtime configuration/security; build, restart local dashboard, provide working links and remaining work.
Production public URL configuration does not provision hosting, certificates or an Android signing identity. No outbound test emails or public deployment.

Configuration validation: encrypted SMTP save/redaction/password retention, admin-only access, persisted runtime password-reset/Serve delivery via a loopback SMTP sink, connection checks that send no message, production URL validation and public ministry-link propagation all pass. Web Settings has all three sections and no browser exceptions. Android settings build/lint pass; release properties export imports successfully. Dashboard bound to 0.0.0.0:3177 for laptop/phone hotspot access. Existing production keys/real credentials were not changed.


## Active task — web/native admin parity (approved 2026-10-29)
- [x] 1. Complete parity inventory and align shared navigation, Users and native visual identity.
- [x] 2. Consolidate publishing with explicit Single/Batch, named categories, scheduling and free/paid controls.
- [x] 3. Generate private PDF first-page covers server-side; preserve manual overrides.
- [x] 4. Bring Serve teams, current live/replays, moderation and ministry settings to web.
- [x] 5. Correct financial classification; add monetization analytics, filters, item breakdown and CSV.
- [x] 6. Verify roles, shared workflows, builds and local dashboard; report concrete remaining limitations.
Constraints: preserve accounts, credentials, permissions, content and purchases. No production deployment, external messages or phone hotspot changes. No invented engagement analytics.


## Active task — intuitive scheduling, full web studio and deployment readiness (approved 2026-10-29)
- [x] 1. Shared native calendar/time dialogs and web date/time pickers throughout authoring/reporting.
- [x] 2. Explicit Publish now / Schedule for later choices for single/batch publishing, defaults and per-item overrides, honoring actual upload completion time.
- [x] 3. Web live controls matching native where supported: screen share, camera/mic/flip, quality/zoom/torch, filters, branding/slides and moderation; clear browser capability fallbacks.
- [x] 4. Admin operational integrations: M-Pesa credentials/callback/authentication test, card payments, Bible providers, optional media/push services; encrypted, masked and live runtime use. Keep hosting/signing/encryption roots deployment-only.
- [x] 5. Responsive/visibility/ease-of-use review on web and native; complete relevant regression and device checks; build/install QA APK.
- [ ] 6. Run user-confirmed Claude Security skill and official Cloudflare deployment checks; fix verified findings, report readiness and concrete deployment inputs.
- [x] 7. Prepare API/admin archives, optimized QA APK and ministry signing identity/backup. Public deployment and production APK are deferred at the user’s request pending the actual hosting/domain.
Constraints: preserve all prior work/accounts/content/payments, phone hotspot and currently active user apps; no live charges, outbound emails/pushes or production changes during QA. User confirmed Claude Security plus Cloudflare checks. Deployment is requested after finishing and security review, not before. No fabricated credentials or endpoints.

2026-10-29 release-preparation clarification: user explicitly deferred hosting until they provide details and authorized creating the first ministry signing key. Key and private backup created outside source control. Actual production APK remains gated on a real HTTPS API domain; no placeholder production host is being compiled into a release.

Final scope note: standard security review and Cloudflare preparation are documented; official Claude Security workflow remains unavailable and live zone/account checks need access. Earlier native forced-reconnect/cold-start notification acceptance remains a deployment/device acceptance task, not silently marked complete.


## Active task — free direct-R2 live streaming, approved 2026-10-30
- [x] 1. Prove independent HLS segments from existing native/browser encoders without server transcoding.
- [x] 2. Add durable session-scoped signed upload/acknowledgment/manifest endpoints, entitlement-checked playback and bounded quotas.
- [x] 3. Connect phone and browser studio, live player and automatic replay catalogue; preserve legacy path.
- [x] 4. Verify real direct R2 upload/playback, interrupted publishing and free/paid access; run relevant regressions/builds.
- [x] 5. Prepare free-only Render deployment, resolve free persistent database/account access, deploy only after successful checks; build APK for real deployed URL.
User authorizes implementation and deployment after it works well. No paid upgrades, extra servers or usage overages. Never expose credentials or change phone connectivity; keep existing data. Official Claude Security workflow remains unavailable, do not claim it ran.

## Active follow-up — low-delay live, finance receipts and old dashboard URL (30 October 2026)
- [ ] Reduce capture/queue/player delay and measure actual phone latency; preserve encrypted paid replays and free hosting.
- [x] Add explicit native/web receipt print controls for finance permissions, verify paid receipt authorization.
- [x] Update resumed old Render dashboard URL to reach current admin, deploy changes and install updated same-key APK preserving data.
User reports current streaming works but is delayed. Literal instant video cannot be promised on segmented HLS; measure and report achieved latency. Do not provision paid real-time providers. Existing phone production2.0.2 installed with ministry key; update from now on with same key, no uninstall.
