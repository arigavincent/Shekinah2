# Phase 2 and Phase 3 Audit

Audit date: 2026-06-10

This audit is based on the current codebase, local PostgreSQL schema/data, and wired routes in the mobile app, backend, and admin dashboard.

## Phase 2

### Done

- Backend foundation exists in Go with:
  - environment config
  - PostgreSQL connection
  - startup migrations
  - auth middleware
  - health endpoints
- Public content API exists:
  - `GET /api/v1/home`
- Admin auth exists:
  - register
  - login
  - current user
  - password change
  - forced password reset for seeded admin
- Admin dashboard exists with real pages for:
  - sermons
  - devotions
  - events
  - updates
  - branches
  - live config
  - giving
  - notifications
- Admin CRUD endpoints exist for:
  - sermons
  - devotions
  - events
  - updates
  - branches
  - live config update
- Media upload endpoint exists:
  - `POST /api/v1/admin/media`
- M-Pesa backend endpoints exist:
  - STK push
  - callback
  - transaction lookup
  - admin transaction list
- Notification backend exists:
  - device registration
  - preference update
  - broadcast send
  - message history
- Mobile app is wired to backend-shaped content through `EXPO_PUBLIC_API_BASE_URL`.
- Mobile auth is wired:
  - register
  - login
  - session persistence
- Mobile giving is wired to backend:
  - STK push request
  - transaction status lookup
- Local PostgreSQL schema is present with migrated tables for:
  - content
  - users
  - giving transactions
  - notification devices/messages
  - live config
  - about content

### Partial

- Production deployment setup exists, but is not confirmed live:
  - `render.yaml`
  - production env templates
  - release runbook
- Seed data is present, but much of it is still placeholder/demo level:
  - sermons: 14
  - clips: 13
  - devotions: 3
  - events: 3
  - branches: 2
  - updates: 2
- Admin account exists, but is still the seeded account:
  - `vincent@example.com`
  - password reset required
- Cloudinary integration exists in code, but credentials are not configured.
- Notification delivery code exists, but local DB currently shows:
  - `notification_devices = 0`
  - `notification_messages = 0`
- Giving backend exists, but local DB currently shows:
  - `giving_transactions = 0`
- Mobile notification settings screen exists, but real device delivery is not yet verified.
- Prayer request submission endpoint exists, but this is still a lightweight form flow rather than the full Phase 3 prayer wall model.

### Pending

- Member profile update endpoint/UI is not completed.
- Profile photo upload is not completed.
- Persisted UI language to backend account is not completed.
- Server-side member features are not completed:
  - liked sermons
  - favourite devotions
  - watch/listen progress sync
  - continue watching/listening sync
  - sermon/devotion stats sync
- Member-specific giving history API is not completed.
- Statement download endpoint is not completed.
- Global search backend endpoint is not completed.
- Serve form backend endpoint is not completed.
- Real production configuration is not completed:
  - Cloudinary credentials
  - Daraja credentials
  - final JWT secret
  - allowed origins
  - real callback URLs if changed
- Production QA is not completed:
  - real payment flow
  - real notification delivery
  - admin create/edit/delete verification in deployed environment
  - multi-device smoke testing

## Phase 3

### Already Started

- Offline Bible foundation is already present:
  - bundled database in mobile app
  - Bible reader screen
- Offline sermon download foundation is already present:
  - local file download
  - delete flow
  - downloads manager
  - offline reopen path for downloaded media
- Basic prayer wall UI is already present.
- Mobile auth exists, which helps later Phase 3 member features.

### Partial

- Prayer wall is only partial:
  - public list UI exists
  - local praying count behavior exists
  - submission endpoint exists
  - full signed-in ownership/public-private model is not completed
- Sermon downloads are partial relative to the original Phase 3 scope:
  - local downloads exist
  - account-linked sync metadata does not
- Bible is partial relative to the original Phase 3 scope:
  - bundled offline text exists
  - bookmarks exist locally
  - downloadable extra versions do not
  - sync to account does not

### Pending

- Downloadable Bible versions
- Bible version provider selection/licensing
- Synced Bible bookmarks/highlights/notes
- Full prayer wall permissions and moderation
- Real-time chat
- Sermon notes
- Testimonies feed
- QR event check-in
- Bible reading plans
- Full Kiswahili localization across the app
- Card payment flow
- Advanced profile stats
- Full Phase 3 offline/online QA

## Database Snapshot

Local database counts observed during this audit:

- `sermons = 14`
- `devotions = 3`
- `events = 3`
- `branches = 2`
- `updates = 2`
- `clips = 13`
- `users = 1`
- `giving_transactions = 0`
- `notification_devices = 0`
- `notification_messages = 0`
- `prayers = 2`
- `platforms = 3`
- `scriptures = 1`
- `live_stream_config = 1`
- `sermon_categories = 6`
- `about_content = 1`

## Practical Conclusion

Phase 2 should be treated as:

- implemented at development level
- not yet finished at production-operational level

Phase 3 should be treated as:

- only partly started
- still mostly remaining

The next sensible work is not a brand-new Phase 3 feature. It is to close the remaining Phase 2 operational gaps first:

- replace seeded content
- configure real credentials
- test notifications
- test M-Pesa
- deploy and smoke test backend/admin/mobile together
