# Shekinah release preparation — 29 October 2026

Status: release preparation complete; production deployment is deferred at the owner's request until hosting details are supplied. No public deployment, live payment, external email or push was initiated during this pass.

## Implemented and exercised

- Phone calendar and clock dialogs; web calendar/time fields. Single/batch queues expose Publish now and Schedule for later, with per-item timing and separate historical dates. Immediate publication uses the time the upload completes.
- Responsive admin settings/publisher/studio layouts tested at phone widths. Phone tool choices wrap, exposing tools that previously required sideways scrolling.
- Browser live compositor: camera/microphone, camera switching, quality selection, digital zoom/effects, supported-camera torch, screen/shared sound, PDF/image slides and pagination, camera inset, scripture, break screen, logo and lower banner. A real H.264/Opus broadcast using the compositor reached MediaMTX. Screen-source switching was exercised with a synthetic capture stream; the browser's native source-selection dialog still depends on the deployed browser/device.
- The recording reached encrypted R2, appeared in the member Sermons catalogue, and streamed through the private gateway with HTTP 206 and private/no-store caching. The exact QA recording and its object/cache/feed entries were then removed. Accounts, grants and purchases were preserved.
- Saved encrypted/masked runtime integrations for Daraja, Flutterwave, Bible Brain, API.Bible, optional Cloudflare Stream/Cloudinary and Firebase, alongside the existing Spotify RSS/SMTP/production settings. Admin-only configuration is enforced server-side. Safe connection checks do not charge, upload or deliver messages.
- Payment regression uses disposable PostgreSQL and mocked providers: server-authoritative purchase prices, required client request IDs, one prompt per repeated request, authenticated checkout-bound callbacks across token changes, amount/phone/merchant matching, malformed-number rejection, lost-response recovery, callbacks arriving before submission acknowledgement, and verified card settlement. Existing live purchases retain replay access; other purchasers still need to pay.
- Production startup checks reject weak signing roots, invalid library encryption roots and active demonstration accounts with known default passwords. These checks do not change account records.

## Validation status

TypeScript and the production web build passed. Android debug/optimized QA builds and lint passed; nonfatal Gradle/R8 warnings and 135 lint warnings remain (zero lint errors). The final QA APK was signature-verified and installed on the TECNO and the real date/time dialogs were checked. The QA APK uses localhost and a development signing certificate.

Bun audit reported no known vulnerabilities in the dashboard dependency graph. Initial Go vulnerability checking identified 27 reachable advisories in the existing Go 1.26.2 toolchain and dependencies. Updated to Go 1.26.10, x/net 0.60.0, x/crypto 0.57.0, x/text 0.42.0 and quic-go 0.59.1 (with their required transitive updates). The full Go suite passes on the patched toolchain. Final govulncheck reports **zero vulnerabilities affecting called code and zero vulnerabilities in imported packages**.

Three advisory matches remain only in required modules whose affected packages are not imported: [GO-2026-6866](https://pkg.go.dev/vuln/GO-2026-6866) and [GO-2026-6860](https://pkg.go.dev/vuln/GO-2026-6860) concern x/net/html; [GO-2026-5932](https://pkg.go.dev/vuln/GO-2026-5932) concerns the unused, unmaintained OpenPGP package within x/crypto. They are not described as fixed or as reachable application findings. Keep reviewing dependencies when changing imports; the OpenPGP advisory has no fixed version.

The first ministry RSA4096 signing identity and private backup have been created outside the repository. The actual production HTTPS API domain is required before building the final ministry-signed APK/AAB. See [the native release runbook](NATIVE_ANDROID_RELEASE.md).

Daraja merchant configuration separates the approved business/store shortcode from the receiving till number. Request reference/description limits follow [Safaricom’s M-Pesa Express specification](https://developer.safaricom.co.ke/apis/MpesaExpressSimulate); mocked tests verify Paybill and Buy Goods payloads. No live payment was requested.

## Claude Security scan

The requested Claude Security scan did **not** run. Its installed [scan recipe](/home/ariga/.claude/plugins/marketplaces/claude-plugins-official/plugins/claude-security/skills/claude-security/jobs/scan-codebase.md) states: “The Workflow tool is required” and “Never stand in for the workflow by dispatching researchers and verifiers yourself”. That Workflow tool is unavailable in this session. This file records engineering checks and deployment preparation; it is not a Claude Security report or certification. Run that official workflow in an enabled session before treating the requested scan gate as complete.

## Cloudflare checks and deployment requirements

| Area | Check / required configuration |
|---|---|
| HTTPS | Camera/screen APIs require a secure browser origin. Configure valid origin certificates and [Full (strict) TLS](https://developers.cloudflare.com/ssl/origin-configuration/ssl-modes/full-strict/); use HTTPS for both dashboard and API. |
| Private paid media | Keep encrypted book/recording objects private; deliver them through entitlement-checked API routes. [R2 public access](https://developers.cloudflare.com/r2/buckets/public-buckets/) must not be enabled for plaintext paid material. Actual account/bucket policy inspection needs Cloudflare account access; it has not been claimed here. |
| Upload/download URLs | Treat [presigned R2 URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) as temporary bearer credentials. They use the S3 endpoint rather than an R2 custom domain. Configure narrow [CORS origins/methods](https://developers.cloudflare.com/r2/buckets/cors/) when using browser-direct uploads. Current same-origin API publishing avoids browser R2 CORS for its proxied transfers. |
| Caching | Keep authenticated API, payment status/callbacks, private books, replays and Range responses out of edge caches. The private gateway/proxy emits no-store. Review Cache Rules so overrides cannot bypass [origin cache controls](https://developers.cloudflare.com/cache/concepts/default-cache-behavior/). |
| Live networking | Ordinary Cloudflare HTTP proxying does not carry raw RTMP or WebRTC UDP. The [supported-port list](https://developers.cloudflare.com/fundamentals/reference/network-ports/) excludes the current 1935/8189 media ports. Provide a reachable media host/ICE configuration, secure signaling/HLS routing and the required firewall ports. MediaMTX's control API (9997) remains private. |
| Payment callbacks | Publish the actual Daraja callback and card return paths over HTTPS. Machine callbacks must reach the API without an interactive browser challenge. Preserve backend callback verification and verify actual merchant/amount/receipt settlement in a controlled provider acceptance test. OAuth success alone is insufficient. |
| Hosting and persistence | Choose a host with PostgreSQL, durable shared upload/recording/cache storage and the required media networking. Install ffmpeg and poppler-utils. Preserve encryption roots, restrict DB/control interfaces and arrange database/storage backups. Render is now selected for API/admin; the database and live-media layout still need finalization. |
| Account settings | Production URLs are blank and Render account/service access has not yet been provided. A Cloudflare zone/token was not available for inspecting live DNS/TLS/WAF settings. These account-level checks remain pending actual hosting/access. |

## Final device/provider acceptance

The earlier native forced-reconnection check and closed-app notification delivery/tap check remain unverified. Repeat them against the deployed API/media/push configuration; these checks must preserve the phone hotspot. Real M-Pesa/card settlement, SMTP delivery and browser/device-specific screen capture/torch also require their actual configured environment.

## Remaining owner inputs

Hosting/project/domain and media networking; actual Spotify feed; provider credentials and real payment callback acceptance when enabling automatic payments; deferred SMTP settings. Deployment must resolve the reported local weak signing root/demo-account readiness checks without overwriting the existing admin or purchases. Back up the ministry signing identity to separate ministry-owned storage before public distribution.

## Hosting direction selected after handoff

Render is selected for the API and admin. Docker can package both services while Neon supplies managed PostgreSQL; these choices work together. A self-managed Docker database remains an alternative requiring its own persistence, backups and maintenance.

The current live media server requires public RTMP/WebRTC networking and shares recording files with the API archive worker. [Render public web services forward one HTTP port](https://render.com/docs/web-services#binding-to-multiple-ports), and [persistent disks cannot be shared across services](https://render.com/docs/disks#disk-limitations-and-considerations). A separate media host therefore requires a secure recording handoff or a co-located archive worker, rather than only changing a hostname. This hosting decision remains open.

For Neon, initially use the direct TLS connection with the application's pgx pool: current live session coordination uses session-level advisory locks, which [Neon's transaction pooler does not support](https://neon.com/docs/connect/connection-pooling#connection-pooling-in-transaction-mode). The existing Render blueprint predates the finished application and needs updating before deployment. No resources have been provisioned.
