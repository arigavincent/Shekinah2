## Goal
Replace the current "Batch Import Wizard" sections in Sermons, Devotions, and Library with a single reusable **Batch Upload** experience that supports both flows you picked, with a per-item publish date. Backend calls stay exactly the same — we just reuse the existing single-item create endpoints in a loop.

## What you'll see in the UI
A single "Batch Upload" button on each of the three pages opens one modal. At the top of the modal a segmented toggle lets you switch between:

- **Queue mode** — Add many items first, review/edit the list, then click "Upload all". Each row shows filename, title, publish date, status, and a per-row progress bar. Failures stay in the list with a Retry button.
- **Wizard mode** — Upload one item, fill details, click "Save & add another" to immediately submit and reset the form. A counter shows "3 of N saved this session". "Finish" closes the modal and refreshes the list.

Both modes share the same form fields, the same per-item **Publish on** date+time picker (shadcn datepicker inside the dialog), and the same validation. The mode toggle persists per section in localStorage so each user's preference sticks.

## What stays the same
- Existing per-page create endpoints (`POST /sermons`, `POST /devotions`, `POST /library`) — the dialog just calls them one row at a time, sequentially, to be gentle on Render.
- Existing single-item "New Sermon / New Devotion / New Library item" forms remain untouched.
- Existing "Batch Import Wizard" section is removed from each page and replaced by the new dialog trigger; no other business logic moves.
- Theming/palette tokens — the new dialog uses the same `.admin-*` primitives and status pills already in `style.css`.

## Sections covered (this pass)
- Sermons
- Devotions
- Library (audio / video / PDF — file accept list switches based on type field)

---

## Technical notes (for me)

Create a generic component:

```
src/admin/components/BatchUploadDialog.tsx
```

Props:
```ts
type BatchUploadDialogProps<T> = {
  open: boolean;
  onClose: () => void;
  title: string;
  storageKey: string;            // remembers mode per section
  accept: string;                 // file input accept attr
  fields: FieldSpec[];            // declarative: text/select/textarea/date
  buildPayload: (file: File, values: Record<string,string>, publishAt: string) => FormData | object;
  submitOne: (payload) => Promise<void>;   // calls existing endpoint
  onCompleted: () => void;        // triggers list refresh
};
```

Per-page wiring:
- `SermonsPage.tsx` — remove lines ~1030–1280 (Batch Import Wizard card + Preview Batch handlers that aren't shared). Add `<BatchUploadDialog>` with fields `title, speaker, series, description, thumbnailUrl` and `publishAt`. `submitOne` reuses the existing `createSermon`/POST handler already in the file.
- `DevotionsPage.tsx` — same pattern, fields `title, scripture, body, author`, plus `publishAt` (this maps to the existing schedule date the page already supports).
- `LibraryPage.tsx` — fields `title, type(audio|video|pdf), description, tags`, `accept` switches on `type`.

Mode toggle: `useState<'queue'|'wizard'>` initialised from `localStorage[storageKey]`, written back on change.

Queue mode internals:
- `items: Array<{ id, file, values, publishAt, status: 'pending'|'uploading'|'done'|'error', progress, error? }>`
- "Upload all" iterates sequentially via `for…of`, awaiting `submitOne`, updating per-row status.
- Per-row Edit reopens the form prefilled.

Wizard mode internals:
- Single in-progress form. On "Save & add another" → `submitOne` → on success: reset form, increment counter, keep modal open. On "Finish" → close + `onCompleted()`.

Publish date: shadcn `Popover + Calendar` (with `pointer-events-auto`) + a time `<input type="time">`. Combined into ISO string sent as `publishAt`. Backend already filters by `publishAt <= NOW()` if that field exists; if it doesn't yet, the field is still sent and ignored — wiring server-side filtering is a separate ask (see follow-up).

Keep the existing single-item create dialogs untouched.

## Out of scope (ask me after)
- Adding the `publish_at` column server-side / filtering API responses by it.
- FCM push notifications when content goes live.
- Other admin sections (Notifications, Updates, Reading Plans, etc.).
