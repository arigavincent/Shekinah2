# Production Credentials Inventory

Do not commit real secrets. Store production secrets in Render, EAS, and the relevant provider dashboards.

## Backend

- `DATABASE_URL`: Render managed database connection string.
- `JWT_SECRET`: strong generated secret.
- `ALLOWED_ORIGINS`: deployed admin dashboard origin, for example `https://shekinah-sons-admin.onrender.com`.
- `PASSWORD_RESET_TTL_MINUTES`: reset code lifetime, default `15`.
- `PASSWORD_RESET_MAX_ATTEMPTS`: failed-code limit, default `5`.
- `SMTP_HOST`: SMTP host for password reset OTP email.
- `SMTP_PORT`: SMTP port for password reset OTP email.
- `SMTP_FROM`: sender email for password reset OTP email.
- `SMTP_USERNAME`: SMTP username.
- `SMTP_PASSWORD`: SMTP password.

## Media Storage

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

## M-Pesa Daraja

- `MPESA_ENV=production`
- `MPESA_CONSUMER_KEY`
- `MPESA_CONSUMER_SECRET`
- `MPESA_SHORTCODE`
- `MPESA_PASSKEY`
- `MPESA_CALLBACK_URL`
- `MPESA_TRANSACTION_TYPE`
- `MPESA_ACCOUNT_REFERENCE`

## Admin Dashboard

- `VITE_API_BASE_URL`: production backend URL.

## Mobile App

- `EXPO_PUBLIC_API_BASE_URL`: production backend URL.
- EAS project access.
- Android signing credentials in EAS or local keystore.

## Push Notifications

- Final provider app ID/key.
- Android FCM credentials if the final provider requires them.

## Maps and Bible Provider

- Google Maps API/deep-link configuration, if using API calls beyond links.
- Bible version provider API key/license, if additional downloadable versions go live.

## Payment Cards

- Stripe/Flutterwave public key.
- Stripe/Flutterwave secret key.
- Webhook/callback signing secret.
- Production callback URL.
