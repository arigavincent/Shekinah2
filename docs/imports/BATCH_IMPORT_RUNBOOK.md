# Batch Import Runbook

This import flow is designed to behave more like a content-ingestion pipeline than a raw CSV paste tool.

## What changed

- every sermon and devotion now has a stable `externalId`
- import runs in two steps:
  1. `Preview CSV`
  2. `Apply Import`
- preview classifies rows as:
  - `create`
  - `update`
  - `reject`
- repeated imports are idempotent because matching is done on `externalId`
- public app visibility still depends on `publishedAt <= now()`

## Source fixtures

Use these files from the repo:

- `docs/imports/shekinah_youtube_sermons_batch.csv`
- `docs/imports/shekinah_monthly_devotions_batch.csv`

The sermon fixture is sourced from the official Shekinah Sons Global YouTube channel metadata already used in the app.

## Required headers

### Sermons

```text
externalId,type,title,speaker,sermonDate,publishedAt,categoryId,isLive,thumbnailUrl,duration,description,mediaUrl
```

### Devotions

```text
externalId,title,excerpt,devotionDate,publishedAt,imageUrl,body
```

## Operator test flow

### 1. First sermon import

1. Open `Admin -> Sermons`
2. In `Batch Import`, load `docs/imports/shekinah_youtube_sermons_batch.csv`
3. Click `Preview CSV`
4. Expected:
   - `create = 8`
   - `update = 0`
   - `reject = 0`
5. Click `Apply Import`

### 2. Idempotency check

1. Load the exact same sermon CSV again
2. Click `Preview CSV`
3. Expected:
   - `create = 0`
   - `update = 8`
   - `reject = 0`
4. Click `Apply Import`
5. No duplicates should be created

### 3. Update behavior check

1. Open the sermon CSV in a text editor
2. Change one row only:
   - title
   - description
   - publishedAt
3. Keep the same `externalId`
4. Preview again
5. Expected:
   - that row is `update`
   - apply updates the existing sermon instead of creating a new one

### 4. Scheduling check

The provided sermon fixture intentionally mixes already-publishable rows and future rows.

Expected on current test dates:
- rows published on or before current backend time appear in the app/public APIs
- rows with future `publishedAt` stay hidden until their time arrives

Verify with:

```text
GET /api/v1/home
GET /api/v1/admin/sermons
```

Admin should show all imported rows. Public APIs should only show rows whose `publishedAt` has already passed.

### 5. Devotion import

1. Open `Admin -> Devotions`
2. Load `docs/imports/shekinah_monthly_devotions_batch.csv`
3. Preview
4. Apply
5. Repeat the same file to confirm all rows come back as `update`

### 6. Rejection check

Create a broken copy of either file and test:
- remove `externalId`
- use invalid `publishedAt`
- remove required `mediaUrl` or `body`

Expected:
- preview marks the row as `reject`
- apply does not write that row

## Public app checks

After import:

1. Reload the app
2. Check `Home`
3. Check `Sermons`
4. Check `Devotions`

Expected:
- items with past/current `publishedAt` appear
- future items do not appear yet

## Practical content rules

- treat `externalId` as the permanent ingestion key
- change metadata freely
- do not change `externalId` unless you intentionally want a new record lineage
- upload media first, then reference final asset URLs in the CSV if you want stable production imports
