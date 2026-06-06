# Shekinah Sons Global Church App - Final Roadmap

## Product Direction

Build a polished Android church app for Shekinah Sons Global with a dark, immersive media-first experience inspired by the Phaneroo app, adapted to Shekinah Sons Global colors: pure black, warm gold, deep blue, white, and light grey.

The project will be delivered in 3 phases:

1. **Phase 1 - Core Android APK**
2. **Phase 2 - Backend, Admin, Accounts, Payments, Notifications**
3. **Phase 3 - Advanced Offline, Community, Localization, and Growth Features**

## Recommended Stack

### Android App

- React Native with Expo prebuild
- Android APK output
- React Navigation for bottom tabs, drawer, and screen stacks
- Local/sample JSON content in Phase 1
- Native share, deep links, media playback, and YouTube embeds where needed

### Backend

- Go API backend
- PostgreSQL database
- REST API for app and admin panel
- Cloudflare R2 or S3-compatible storage for sermon audio, images, devotion covers, and event banners
- M-Pesa Daraja API for STK Push
- OneSignal for push notifications

### Admin Panel

- React web dashboard
- Admin login
- Manage sermons, devotions, scripture of the day, events, branches, live stream config, updates, platforms, and giving records

## Product Rules

- Phase 1 should produce a usable, polished APK even before the backend exists.
- Phase 1 uses local/sample content only.
- Phase 1 is dark-only to avoid conflict with the pure black visual requirement.
- Bottom navigation uses exactly 4 tabs: Home, Sermons, Devotions, Live.
- Side drawer exposes all secondary screens.
- Real payments, real accounts, real downloads, and real push notifications wait until Phase 2.
- Advanced community and offline Bible features wait until Phase 3.

---

# Phase 1 - Core Android APK

## Goal

Deliver the first working Android APK that users can open, navigate, and experience as a real Shekinah Sons Global church app, using local sample data.

## Phase 1 Scope

### 1. App Shell

- [ ] Create React Native / Expo app structure.
- [ ] Configure Android APK build.
- [ ] Set app name to `Shekinah Sons Global`.
- [ ] Add app icon, adaptive icon, and splash screen.
- [ ] Use a dark-first theme:
  - [ ] Background: `#000000`
  - [ ] Primary text: white
  - [ ] Secondary text: light grey
  - [ ] Accent: warm gold
  - [ ] Secondary accent: deep blue
- [ ] Add shared design tokens for colors, spacing, typography, and card styles.
- [ ] Add reusable components:
  - [ ] Top app bar
  - [ ] Section header with `View All`
  - [ ] Media card
  - [ ] List row
  - [ ] Tab strip
  - [ ] Empty state
  - [ ] Primary button
  - [ ] Icon button
  - [ ] Screen container

### 2. Navigation

- [ ] Add bottom navigation with 4 tabs:
  - [ ] Home
  - [ ] Sermons
  - [ ] Devotions
  - [ ] Live
- [ ] Active bottom-nav icon and label should be gold.
- [ ] Inactive bottom-nav icon and label should be white/light grey.
- [ ] Live tab should support a pulsing red badge when sample live config says the church is streaming.
- [ ] Add left side drawer opened from hamburger icon.
- [ ] Add stack navigation for detail screens.
- [ ] Add side drawer groups:
  - [ ] Quick Access
  - [ ] Media
  - [ ] Connect
  - [ ] App

### 3. Local Sample Data

- [ ] Create sample data files for:
  - [ ] Sermons
  - [ ] Audio sermons
  - [ ] Sermon categories
  - [ ] Short clips
  - [ ] Devotions
  - [ ] Scripture of the day
  - [ ] Events
  - [ ] Church branches
  - [ ] Live stream config
  - [ ] Updates
  - [ ] Platforms
  - [ ] Prayer requests preview data
  - [ ] Downloads preview data
- [ ] Use stable IDs for all sample records.
- [ ] Use realistic Shekinah Sons Global content placeholders.
- [ ] Use local image assets or remote placeholder images during Phase 1.

### 4. Home Screen

- [ ] Top bar:
  - [ ] Hamburger icon top-left
  - [ ] Church logo centered
  - [ ] Search icon top-right
- [ ] Today's Devotional card:
  - [ ] Thumbnail on left
  - [ ] Deep blue/gold badge
  - [ ] Devotion title
  - [ ] Short scripture excerpt
  - [ ] Date with calendar icon
- [ ] Scripture of the Day card:
  - [ ] Verse text
  - [ ] Bible reference
  - [ ] Share icon
  - [ ] Native share action
- [ ] Latest Video Sermons horizontal row:
  - [ ] Large cards
  - [ ] 2 visible with peek of 3rd
  - [ ] Live sermons show red dot before title
- [ ] Latest Audio Sermons horizontal row:
  - [ ] Square album-art cards
  - [ ] 3 visible with peek of 4th
- [ ] Short Clips horizontal row:
  - [ ] Square cards
  - [ ] Bold overlaid text on image
- [ ] Upcoming Events horizontal row:
  - [ ] Event image
  - [ ] Title
  - [ ] Date/time
  - [ ] Tap opens Events detail/list flow

### 5. Global Search

- [ ] Open from Home search icon.
- [ ] Add search input at top.
- [ ] Search local data across:
  - [ ] Sermons
  - [ ] Devotions
  - [ ] Bible verses/sample scripture
  - [ ] Events
- [ ] Show grouped result sections.
- [ ] Each result shows:
  - [ ] Thumbnail or icon
  - [ ] Title
  - [ ] Type label
- [ ] Tapping result opens relevant detail screen.
- [ ] Add empty state for no results.

### 6. Sermons Screen

- [ ] Top bar:
  - [ ] Hamburger icon top-left
  - [ ] Logo centered
  - [ ] Download icon top-right
  - [ ] Heart icon top-right
- [ ] Add horizontal tab strip:
  - [ ] Video
  - [ ] Audio
  - [ ] Categories
  - [ ] Highlights
- [ ] Active tab uses gold underline.
- [ ] Add pill-shaped search bar below tabs.
- [ ] Video tab:
  - [ ] Scrollable list
  - [ ] Square thumbnail left
  - [ ] Title up to 2 lines
  - [ ] Date in grey
  - [ ] Live red dot where applicable
- [ ] Audio tab:
  - [ ] Same row layout as video
  - [ ] Tapping opens full-screen audio player
- [ ] Categories tab:
  - [ ] 2-column grid
  - [ ] Square image cards
  - [ ] Category name
  - [ ] Sermon count
- [ ] Highlights tab:
  - [ ] List rows
  - [ ] Thumbnail
  - [ ] Title
  - [ ] Date
  - [ ] Circular play button

### 7. Video Sermon Detail

- [ ] Open when tapping a video sermon.
- [ ] Show YouTube embed or video placeholder at top.
- [ ] Show title.
- [ ] Show speaker/date/category metadata.
- [ ] Show expandable description.
- [ ] Show related sermons below.
- [ ] Add back navigation.

### 8. Audio Sermon Player

- [ ] Open when tapping an audio sermon.
- [ ] Full-screen immersive layout.
- [ ] Blurred/tinted background inspired by album art.
- [ ] Large centered album art.
- [ ] Title and speaker name.
- [ ] Playback controls:
  - [ ] Previous
  - [ ] Rewind 15 seconds
  - [ ] Play/pause
  - [ ] Forward 15 seconds
  - [ ] Next
- [ ] Scrub bar with elapsed/total time.
- [ ] Category tag pill.
- [ ] Track counter, for example `1 / 200 From All Sermons`.
- [ ] Bottom action bar:
  - [ ] Repeat
  - [ ] Download placeholder
  - [ ] Queue placeholder
- [ ] Add persistent mini-player above bottom nav when audio is active:
  - [ ] Thumbnail
  - [ ] Title
  - [ ] Pause/play
  - [ ] Close

### 9. Devotions Screen

- [ ] Top bar:
  - [ ] Hamburger icon top-left
  - [ ] Logo centered
  - [ ] Bookmark/save icon top-right
- [ ] Add tabs:
  - [ ] Latest
  - [ ] Favourites
- [ ] Latest tab:
  - [ ] List of devotion cards
  - [ ] Cover image left
  - [ ] Title
  - [ ] Short excerpt
  - [ ] Date
- [ ] Favourites tab:
  - [ ] Empty state with heart icon
  - [ ] `No Favourites` heading
  - [ ] Instruction text
  - [ ] Saved devotions appear using same card layout
- [ ] Tapping devotion opens detail screen.

### 10. Devotion Detail

- [ ] Show full devotion title.
- [ ] Show date.
- [ ] Show body text.
- [ ] Add heart/save action.
- [ ] Persist favourites locally with AsyncStorage for Phase 1.

### 11. Live Stream Screen

- [ ] Read local live stream config.
- [ ] If not streaming:
  - [ ] Show church logo
  - [ ] `No live service right now`
  - [ ] Next service schedule/countdown display
  - [ ] Bell notification placeholder
- [ ] If streaming:
  - [ ] Show YouTube Live embed full-width
  - [ ] Show stream title
  - [ ] Show sample live viewer count
  - [ ] Show comments/reactions strip as sample UI
- [ ] Show `Past Services` list below.

### 12. Downloads Manager

- [ ] Add side drawer link under Media.
- [ ] Add tabs:
  - [ ] Sermons
  - [ ] Bible Versions
- [ ] Sermons tab:
  - [ ] Show sample downloaded sermon list
  - [ ] Thumbnail
  - [ ] Title
  - [ ] File size
  - [ ] Delete placeholder button
  - [ ] Storage usage bar
- [ ] Bible Versions tab:
  - [ ] Show English and Kiswahili as bundled/non-deletable
  - [ ] Show sample downloaded version
  - [ ] Delete placeholder button for non-bundled version

### 13. Church Branches / Locations

- [ ] Add side drawer link under Connect and About screen.
- [ ] Show list of branch cards.
- [ ] Each card includes:
  - [ ] Branch name
  - [ ] Address
  - [ ] Service days/times
  - [ ] Phone number
  - [ ] Get Directions button
- [ ] Get Directions opens Google Maps/deep link using coordinates.
- [ ] Add optional list/map toggle UI, with map as placeholder in Phase 1.

### 14. Profile Screen

- [ ] Add side drawer link under Quick Access.
- [ ] Add tabs:
  - [ ] My Profile
  - [ ] Settings
- [ ] My Profile tab:
  - [ ] Guest user avatar if not signed in
  - [ ] Sign In / Register placeholder button
  - [ ] Profile photo placeholder
  - [ ] Full name/email/phone placeholders
  - [ ] Stats row:
    - [ ] Sermons watched
    - [ ] Devotions read
    - [ ] Total given hidden by default
  - [ ] Quick links:
    - [ ] My Downloads
    - [ ] Giving History
    - [ ] Saved Devotions
    - [ ] My Prayer Requests
- [ ] Settings tab:
  - [ ] Language selector UI: English / Kiswahili
  - [ ] Notification preferences link
  - [ ] Dark-only theme note or disabled theme toggle for Phase 1
  - [ ] Send Feedback
  - [ ] App version

### 15. Bible Screen

- [ ] Add side drawer link.
- [ ] Provide Phase 1 Bible reader shell.
- [ ] Show version selector with:
  - [ ] English
  - [ ] Kiswahili
- [ ] Add Book -> Chapter -> Verse navigation UI.
- [ ] Show sample chapter text.
- [ ] Add bookmark/highlight placeholder buttons.
- [ ] Add `Download More Versions` placeholder.
- [ ] Mark full offline Bible database and downloadable versions as Phase 3.

### 16. Events Screen

- [ ] Add access from Home and side drawer.
- [ ] Show scrollable list of event cards.
- [ ] Event card includes:
  - [ ] Full-width banner image
  - [ ] Title
  - [ ] Date/time
  - [ ] Location/venue
  - [ ] Short description
- [ ] Tapping event opens detail screen.
- [ ] Event detail includes:
  - [ ] Larger image
  - [ ] Full description
  - [ ] Add to Calendar placeholder/deep link if feasible

### 17. Giving Screen

- [ ] Add side drawer link under Quick Access.
- [ ] Add tabs:
  - [ ] Give Now
  - [ ] Give History
- [ ] Give Now:
  - [ ] Header: `Give to Shekinah Sons Global`
  - [ ] Category cards:
    - [ ] Tithe
    - [ ] Offering
    - [ ] Special Seed
  - [ ] Amount input with number keyboard
  - [ ] Payment method selector:
    - [ ] M-Pesa
    - [ ] Airtel Money
    - [ ] Visa/Mastercard
  - [ ] Phone number input for M-Pesa/Airtel
  - [ ] Submit button
  - [ ] Phase 1 success/failure mock state
- [ ] Give History:
  - [ ] Show sample giving records
  - [ ] Download Statement placeholder
- [ ] Real M-Pesa STK Push waits for Phase 2.
- [ ] Card payments wait for Phase 3.

### 18. Prayer Wall Preview

- [ ] Add side drawer link under Connect.
- [ ] Show tabs:
  - [ ] All Prayers
  - [ ] My Requests
- [ ] All Prayers:
  - [ ] Show sample public prayer requests
  - [ ] Name or Anonymous
  - [ ] Request text
  - [ ] Date
  - [ ] Praying button with count
- [ ] My Requests:
  - [ ] Show sign-in required state
  - [ ] Add request button disabled/placeholder
- [ ] Real posting waits for Phase 3 unless moved earlier.

### 19. Updates Screen

- [ ] Add side drawer link under Quick Access.
- [ ] Show announcement rows:
  - [ ] Square thumbnail
  - [ ] Title
  - [ ] Short excerpt
  - [ ] Date
- [ ] Support service announcements, events, and prayer points.

### 20. Platforms Screen

- [ ] Add side drawer link under Media as `Our Platforms`.
- [ ] Add tabs:
  - [ ] Web
  - [ ] TV
  - [ ] Radio
- [ ] Each tab shows platform entries:
  - [ ] Icon
  - [ ] Platform name
  - [ ] Schedule/description
  - [ ] Open link button if URL exists

### 21. Serve Screen

- [ ] Add side drawer link under Connect.
- [ ] Build form UI, not a webview.
- [ ] Fields:
  - [ ] First Name
  - [ ] Last Name
  - [ ] Phone Number
  - [ ] Email
  - [ ] Date of Birth
  - [ ] City
  - [ ] Country
  - [ ] Ministry interest dropdowns
- [ ] Submit button shows mock success in Phase 1.
- [ ] Form screen may use white background only if the final design requires it; otherwise keep dark for consistency in v1.

### 22. Notifications Screen

- [ ] Add side drawer link under App.
- [ ] Show notification preference toggles:
  - [ ] New sermons
  - [ ] New devotions
  - [ ] Live service alerts
  - [ ] Upcoming events
  - [ ] New prayer points
- [ ] Store preferences locally in Phase 1.
- [ ] Real OneSignal setup waits for Phase 2.

### 23. About & Contact Screen

- [ ] Add side drawer link under App.
- [ ] Full-width hero congregation photo at top.
- [ ] Church name overlaid on hero image.
- [ ] Get In Touch section:
  - [ ] Horizontally scrollable cards
  - [ ] Deep blue/gold cards
  - [ ] Address/location/phone with icons
- [ ] Our Vision section:
  - [ ] Gold heading
  - [ ] Body text
- [ ] About Shekinah Sons Global section:
  - [ ] Gold heading
  - [ ] Body text

### 24. Phase 1 QA

- [ ] App launches successfully on Android emulator/device.
- [ ] APK builds successfully.
- [ ] All bottom tabs work.
- [ ] Side drawer opens from every main screen.
- [ ] Every drawer item navigates somewhere useful.
- [ ] Search returns grouped results.
- [ ] Video detail opens.
- [ ] Audio player opens and mini-player state works.
- [ ] Devotion favourites persist locally.
- [ ] Scripture share action works.
- [ ] Google Maps direction link opens.
- [ ] Forms validate basic required fields.
- [ ] No screen has unreadable text on black background.
- [ ] No UI text overlaps on common Android viewport sizes.
- [ ] Bottom nav and mini-player do not block critical content.

---

# Phase 2 - Backend, Admin, Accounts, Payments, Notifications

## Goal

Turn the Phase 1 APK into a real operational platform with dynamic content, user accounts, admin publishing, M-Pesa payments, and push notifications.

## Phase 2 Scope

### 1. Go Backend Foundation

- [ ] Create Go backend project.
- [ ] Add REST API structure.
- [ ] Add environment config.
- [ ] Add health check endpoint.
- [ ] Add PostgreSQL connection.
- [ ] Add database migrations.
- [ ] Add request validation.
- [ ] Add structured logging.
- [ ] Add API error response format.
- [ ] Add authentication middleware.

### 2. Database Models

- [ ] Members
- [ ] Sermons
- [ ] Sermon categories
- [ ] Devotions
- [ ] Events
- [ ] Church branches
- [ ] Live stream config
- [ ] Scripture of the day
- [ ] Updates
- [ ] Platforms
- [ ] Giving records
- [ ] Liked sermons
- [ ] Favourite devotions
- [ ] Watch/listen history
- [ ] Push notification preferences
- [ ] Download metadata

### 3. App API Endpoints

- [ ] Fetch home content.
- [ ] Fetch sermons.
- [ ] Fetch sermon detail.
- [ ] Fetch sermon categories.
- [ ] Fetch devotions.
- [ ] Fetch devotion detail.
- [ ] Fetch scripture of the day.
- [ ] Fetch events.
- [ ] Fetch event detail.
- [ ] Fetch branches.
- [ ] Fetch live stream config.
- [ ] Fetch updates.
- [ ] Fetch platforms.
- [ ] Submit serve form.
- [ ] Save notification preferences.
- [ ] Global search endpoint.

### 4. User Accounts

- [ ] Email/password registration.
- [ ] Login.
- [ ] Logout/token invalidation strategy.
- [ ] Password reset.
- [ ] Member profile endpoint.
- [ ] Update profile endpoint.
- [ ] Optional profile photo upload.
- [ ] Persist UI language preference.
- [ ] Persist notification preferences.

### 5. Saved User Features

- [ ] Like/unlike sermon.
- [ ] Save/remove favourite devotion.
- [ ] Fetch liked sermons.
- [ ] Fetch favourite devotions.
- [ ] Save watch/listen progress every 30 seconds.
- [ ] Fetch continue-watching/listening progress.
- [ ] Track sermon watch count.
- [ ] Track devotion read count.

### 6. Admin Panel

- [ ] Create React admin dashboard.
- [ ] Admin login.
- [ ] Admin roles/permissions.
- [ ] Dashboard overview.
- [ ] Manage sermons:
  - [ ] Create
  - [ ] Edit
  - [ ] Delete/archive
  - [ ] Upload thumbnail
  - [ ] Set video URL/audio URL
  - [ ] Assign category
- [ ] Manage devotions.
- [ ] Manage scripture of the day.
- [ ] Manage events.
- [ ] Manage branches.
- [ ] Manage live stream config.
- [ ] Manage updates.
- [ ] Manage platforms.
- [ ] View giving records.
- [ ] Manage notification broadcasts.

### 7. Storage

- [ ] Configure Cloudflare R2 or S3-compatible storage.
- [ ] Upload sermon thumbnails.
- [ ] Upload sermon audio files.
- [ ] Upload devotion cover images.
- [ ] Upload event banners.
- [ ] Upload branch/about images.
- [ ] Store file metadata in PostgreSQL.
- [ ] Use signed upload/download URLs where appropriate.

### 8. M-Pesa Daraja Integration

- [ ] Add Safaricom Daraja credentials to backend environment.
- [ ] Implement OAuth token retrieval.
- [ ] Implement STK Push request endpoint.
- [ ] Implement callback endpoint.
- [ ] Persist transaction reference.
- [ ] Poll or reconcile transaction status.
- [ ] Show success/failure/pending states in app.
- [ ] Store giving record after confirmed payment.
- [ ] Add backend tests for M-Pesa request/callback handling.

### 9. Giving History

- [ ] Fetch member giving history.
- [ ] Show date, amount, category, payment method, and transaction reference.
- [ ] Hide totals by default in profile.
- [ ] Add statement download endpoint if required for Phase 2.

### 10. Push Notifications

- [ ] Configure OneSignal app.
- [ ] Add OneSignal package/config to React Native app.
- [ ] Register device/player ID with backend.
- [ ] Store member notification preferences.
- [ ] Send notification when:
  - [ ] New sermon is published
  - [ ] New devotion is published
  - [ ] Church goes live
  - [ ] Upcoming event reminder is sent
- [ ] Add notification preferences screen wiring.

### 11. Backend Integration in App

- [ ] Replace local sermons with API data.
- [ ] Replace local devotions with API data.
- [ ] Replace local events with API data.
- [ ] Replace local branches with API data.
- [ ] Replace local updates/platforms with API data.
- [ ] Replace local live config with API data.
- [ ] Keep local fallback/error states.
- [ ] Add loading states.
- [ ] Add offline-friendly cached last-known content where practical.

### 12. Deployment

- [ ] Deploy Go backend.
- [ ] Deploy PostgreSQL database.
- [ ] Deploy admin panel.
- [ ] Configure production environment variables.
- [ ] Configure storage bucket.
- [ ] Configure app API base URL.
- [ ] Build production APK connected to backend.
- [ ] Add basic monitoring/logging.

### 13. Phase 2 QA

- [ ] Admin can create content and it appears in app.
- [ ] Member can register and login.
- [ ] Member can save devotions and like sermons.
- [ ] Watch/listen progress resumes correctly.
- [ ] M-Pesa STK Push works in sandbox/production as configured.
- [ ] Giving history updates after confirmed payment.
- [ ] Push notification opt-in works.
- [ ] New sermon/devotion notifications can be sent.
- [ ] API handles invalid input and auth failures safely.
- [ ] App handles network failure gracefully.

---

# Phase 3 - Advanced Offline, Community, Localization, and Growth Features

## Goal

Add deeper member engagement, richer offline capability, full localization, and advanced church operations.

## Phase 3 Scope

### 1. Offline Bible

- [ ] Bundle English Bible text.
- [ ] Bundle Kiswahili Bible text.
- [ ] Add proper local Bible database.
- [ ] Implement book/chapter/verse navigation.
- [ ] Implement Bible search.
- [ ] Implement bookmarks.
- [ ] Implement highlights.
- [ ] Implement optional notes per verse.
- [ ] Sync bookmarks/highlights to account.

### 2. Downloadable Bible Versions

- [ ] Choose Bible API/content provider.
- [ ] Confirm licensing for downloadable versions.
- [ ] Implement Bible version search.
- [ ] Implement download flow.
- [ ] Store downloaded versions locally.
- [ ] Show downloaded versions in version selector.
- [ ] Allow deleting non-bundled versions.
- [ ] Track downloaded versions in account metadata.

### 3. Offline Sermon Downloads

- [ ] Implement real audio/video file downloads.
- [ ] Store files locally on device.
- [ ] Track metadata:
  - [ ] Title
  - [ ] Thumbnail
  - [ ] File size
  - [ ] Downloaded date
  - [ ] Local file URI
- [ ] Support offline playback.
- [ ] Add delete functionality.
- [ ] Update storage usage bar.
- [ ] Sync download metadata where useful.

### 4. Prayer Wall

- [ ] Allow signed-in members to post prayer requests.
- [ ] Support public/private toggle.
- [ ] Public requests visible to all users.
- [ ] Private requests visible only to owner/admin if allowed.
- [ ] Implement `Praying` action.
- [ ] Prevent duplicate praying count from same member.
- [ ] Add moderation/admin controls.
- [ ] Add notification support for new prayer points if enabled.

### 5. Real-time Chat

- [ ] Decide chat provider or custom WebSocket service.
- [ ] Add community chat screen.
- [ ] Add live stream chat if custom chat is required.
- [ ] Add moderation tools.
- [ ] Add abuse/spam controls.
- [ ] Keep YouTube chat embed/read-only display as fallback.

### 6. Sermon Notes

- [ ] Allow members to create notes while watching/listening.
- [ ] Save notes per sermon.
- [ ] Sync notes to account.
- [ ] Allow edit/delete.
- [ ] Add notes list in profile.

### 7. Testimonies Feed

- [ ] Member testimony submission.
- [ ] Admin moderation.
- [ ] Public testimonies feed.
- [ ] Like/share testimony actions.

### 8. QR Check-in

- [ ] Generate unique QR code per member.
- [ ] Add admin/event check-in scanner flow.
- [ ] Track event attendance.
- [ ] Add check-in history.

### 9. Bible Reading Plans

- [ ] Add reading plan model.
- [ ] Add daily readings.
- [ ] Add progress tracking.
- [ ] Add reminders.
- [ ] Add guided prayer prompts.

### 10. Full Kiswahili UI

- [ ] Add localization framework.
- [ ] Translate static labels.
- [ ] Translate buttons.
- [ ] Translate navigation items.
- [ ] Translate empty states.
- [ ] Translate error messages.
- [ ] Persist selected language to account.
- [ ] Keep sermon/devotion/Bible content in original language unless separate content translations are added.

### 11. Card Payments

- [ ] Choose Stripe or Flutterwave.
- [ ] Add backend payment intent/session flow.
- [ ] Add secure card payment UI.
- [ ] Store confirmed giving records.
- [ ] Add failure/pending handling.
- [ ] Add reconciliation and admin visibility.

### 12. Advanced Profile Stats

- [ ] Sermons watched.
- [ ] Devotions read.
- [ ] Giving totals with hidden/visible toggle.
- [ ] Prayer requests submitted.
- [ ] Reading plan progress.
- [ ] Event check-ins.
- [ ] Download/storage stats.

### 13. Phase 3 QA

- [ ] Bible works without internet.
- [ ] Downloaded sermons play offline.
- [ ] Prayer Wall permissions work correctly.
- [ ] Chat moderation works.
- [ ] Notes sync correctly across devices.
- [ ] Kiswahili UI has no missing core labels.
- [ ] Card payments are tested in sandbox and production.
- [ ] Offline and online states are clearly handled.

---

# Deferred / Needs Decision

These items need a final decision before implementation:

- [ ] Exact Go backend framework:
  - Recommended default: lightweight Go HTTP API with router such as Chi.
- [ ] Database migration tool:
  - Recommended default: Goose or Atlas.
- [ ] Auth method:
  - Recommended default: email/password with JWT access token and refresh token.
- [ ] Storage provider:
  - Recommended default: Cloudflare R2.
- [ ] Bible provider:
  - Needs licensing confirmation before downloadable versions.
- [ ] Card payment provider:
  - Recommended to decide later between Stripe and Flutterwave.
- [ ] Final production APK signing:
  - Needs release keystore, package name, versioning, and Google Play details.

# Immediate Kickoff Checklist for Phase 1

- [ ] Confirm app project location.
- [ ] Confirm whether starting from an existing React Native project or creating a clean new one.
- [ ] Gather final brand assets:
  - [ ] Logo
  - [ ] App icon
  - [ ] Splash image
  - [ ] Congregation/about hero photo
  - [ ] Sermon/devotion/event placeholder images
- [ ] Create Phase 1 React Native app shell.
- [ ] Implement design system and navigation.
- [ ] Build screens using local content.
- [ ] Build Android APK.
- [ ] Test on emulator or real Android device.

