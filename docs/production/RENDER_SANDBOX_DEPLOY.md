# Render Sandbox Deploy

This project is already wired for Render through [`render.yaml`](../../render.yaml).

Use this document to deploy the backend, database, and admin dashboard with Daraja sandbox M-Pesa.

## 1. What Will Be Created

Render blueprint from [`render.yaml`](../../render.yaml) creates:

- PostgreSQL database: `shekinah-sons-db`
- Backend web service: `shekinah-sons-backend`
- Admin web service: `shekinah2`

## 2. Deploy From Render

1. Push this repo to GitHub.
2. Open Render.
3. Click `New +`.
4. Choose `Blueprint`.
5. Connect the GitHub repo.
6. Render will detect [`render.yaml`](../../render.yaml).
7. Review services and continue.

## 3. Backend Environment Variables

Set these on the backend service in Render.

Required application variables:

```text
APP_ENV=production
ALLOWED_ORIGINS=https://shekinah2.onrender.com,https://shekinah-sons-admin.onrender.com
MPESA_ENV=sandbox
MPESA_SHORTCODE=174379
MPESA_TRANSACTION_TYPE=CustomerPayBillOnline
MPESA_ACCOUNT_REFERENCE=Shekinah
MPESA_CALLBACK_URL=https://shekinah-sons-backend.onrender.com/api/v1/giving/mpesa/callback
```

Sensitive values to paste into Render manually:

```text
MPESA_CONSUMER_KEY=<your daraja sandbox consumer key>
MPESA_CONSUMER_SECRET=<your daraja sandbox consumer secret>
MPESA_PASSKEY=<your daraja sandbox passkey>
```

Other backend secrets:

```text
JWT_SECRET=<let render generate or set a strong secret>
```

Database:

- `DATABASE_URL` is already sourced from the managed Render Postgres instance by [`render.yaml`](../../render.yaml).

Optional integrations that can stay blank for now:

```text
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
FLUTTERWAVE_SECRET_KEY=
```

## 4. Admin Dashboard Environment Variable

Set on the static admin service:

```text
VITE_API_BASE_URL=https://shekinah-sons-backend.onrender.com
```

## 5. First Deploy Checks

After Render finishes:

1. Open backend health:

```text
https://shekinah-sons-backend.onrender.com/healthz
```

2. Open admin:

```text
https://shekinah2.onrender.com
```

3. Log in with the seeded admin if it still exists:

```text
email: vincent@example.com
password: password123
```

4. Reset that password immediately after first login.

## 6. Live / Home Data Check

In admin:

1. Open `Live Config`
2. Confirm `Service is currently live` is OFF unless you really want it on
3. Save

Then verify:

```text
https://shekinah-sons-backend.onrender.com/api/v1/home
```

Check that:

- `live.isLive` matches admin
- `live.title` is correct
- `live.viewers` is not fake placeholder data

## 7. M-Pesa Sandbox Test

When backend is live:

1. Open the mobile app against the Render backend.
2. Go to `Giving`.
3. Choose `M-Pesa`.
4. Enter a valid Safaricom sandbox test number.
5. Submit a small amount.

Expected backend behavior:

- transaction row created as `pending`
- STK push request sent
- callback hits:

```text
https://shekinah-sons-backend.onrender.com/api/v1/giving/mpesa/callback
```

- transaction status changes to `success` or `failed`

## 8. Mobile App Update

Before building a release app, set:

```text
EXPO_PUBLIC_API_BASE_URL=https://shekinah-sons-backend.onrender.com
```

## 9. Important Notes

- Do not commit real provider secrets to git.
- The Daraja sandbox consumer secret pasted in chat should be treated as exposed and rotated later if needed.
- If Render gives a different service hostname, update:
  - `ALLOWED_ORIGINS`
  - `VITE_API_BASE_URL`
  - `MPESA_CALLBACK_URL`
  - `EXPO_PUBLIC_API_BASE_URL`

## 10. If You Want Me To Do It

I cannot operate your Render account directly without external access.

The only workable route would be:

- a Render API key
- the GitHub repo URL/branch already available remotely
- approval to use networked terminal commands against the Render API

The simpler path is still: import the blueprint yourself, paste the envs, and I guide each step.
