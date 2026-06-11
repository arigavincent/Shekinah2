# Placeholder Audit

Current known placeholders that must be replaced or confirmed before public launch.

## Backend Seed Content

- Sermon, devotion, event, branch, clip, update, and platform seed rows still use sample titles/text and remote sample images.
- Default branch phone numbers are placeholders.
- `https://example.com` appears in seeded platform data.
- The seeded admin account is only for first setup and is blocked from admin routes until its password is reset.
- Initial YouTube-backed sermon replacements are listed in `docs/production/YOUTUBE_CHANNEL_INVENTORY.md`.

## Mobile Fallback Content

- `phase1_app/src/content.js` contains fallback sample content for offline/API-failure mode.
- Remote sample images are still used in fallback content.
- Mobile fallback platform link includes `https://example.com`.

## Production Secrets

- M-Pesa is configured as sandbox in `render.yaml` until production credentials are supplied.
- Cloudinary, M-Pesa, card processing, final push provider, and Bible provider credentials are not present by design.

## Store and Legal

- Privacy policy draft requires church/legal review.
- Play Store listing draft needs final screenshots, support contact, website, and privacy policy URL.

## Release

- Android package name is set: `com.shekinahsons.globalapp`.
- Production build profile is present in `phase1_app/eas.json`.
- Production signing credentials still need to be created or configured in EAS.
