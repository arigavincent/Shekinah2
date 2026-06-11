# Shekinah Admin Dashboard

React/Vite dashboard for Shekinah Sons Global Phase 2 administration.

## Features

- Login with backend-issued JWT.
- Manage sermons, devotions, events, updates, church branches, and live stream settings.
- Review giving records.
- Send notification broadcasts and view recent notification messages.

## Local Development

Start the backend first, then run:

```bash
npm install
npm run dev
```

Default local API URL is configured in `.env` / `.env.example`:

```text
VITE_API_BASE_URL=http://localhost:3000
```

Local admin login:

```text
Email: vincent@example.com
Password: password123
```

The seeded account must reset its password before dashboard routes are available.

## Build

```bash
npm run build
```

The production API base URL is set by `VITE_API_BASE_URL` during deployment.
