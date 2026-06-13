# Admin Dashboard Refinements

This checklist tracks the admin refinements needed to move the dashboard from a development console into a daily operations tool.

## Priority Order

### 1. Overview And Navigation
- [x] Replace placeholder dashboard cards with live operational metrics
- [x] Add quick actions for the most common publishing tasks
- [x] Group sidebar navigation into clear sections
- [ ] Add route-aware page subtitles and breadcrumbs
- [ ] Add unread/pending count badges in the sidebar

### 2. Data Tables And Filtering
- [ ] Add search, sort, and filter controls to all list-heavy pages
- [ ] Add pagination for sermons, giving, prayers, community, and testimonies
- [ ] Add sticky headers for desktop tables
- [ ] Add consistent empty states with next-step guidance

### 3. Publishing Workflow
- [ ] Introduce draft, published, and archived states for content pages
- [ ] Add publish/unpublish actions without requiring full record edits
- [ ] Add preview mode before saving public content
- [ ] Surface created at / updated at metadata in editors and lists

### 4. Media Management
- [ ] Add image/audio/video previews immediately after upload
- [ ] Show upload progress and clearer upload failure messages
- [ ] Add replace/remove media actions on every media-capable form
- [ ] Surface provider source for media URLs (Cloudinary vs local)

### 5. Operations Safety
- [ ] Add confirmation dialogs for destructive actions
- [ ] Add post-save success toasts and inline failure recovery guidance
- [ ] Add validation summaries at the top of long forms
- [ ] Prevent duplicate submissions on all write actions

### 6. Care And Moderation
- [ ] Add queue filters for private prayers by status
- [ ] Add moderation queue filters for community and testimonies
- [ ] Show pending counts and stale items older than 24h
- [ ] Add internal notes history for prayer follow-up

### 7. Giving And Documents
- [ ] Add giving filters by status, category, and date range
- [ ] Add direct receipt/invoice preview before download
- [ ] Add transaction retry/reconciliation notes for sandbox and live modes

### 8. Mobile And Tablet Admin
- [ ] Tighten mobile table layouts
- [ ] Pin primary save actions on long forms
- [ ] Improve drawer open/close ergonomics on smaller screens

## Current First-Pass Work
- Live dashboard metrics
- Grouped navigation
- Quick-action overview surface
