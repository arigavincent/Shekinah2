# Shekinah on one Oracle server (Johannesburg)

Everything runs on one machine with Docker:

| Part | What it does |
|---|---|
| **caddy** | HTTPS for every address, free certificates renewed automatically |
| **app** | the API and the web admin (same image as on Render) |
| **postgres** | the database |
| **storage** | sermons, books, covers and recordings. SeaweedFS speaks the same S3 language as Cloudflare R2, so the app needs no changes |
| **mediamtx** | the live video server. Phones, OBS, cameras and video switchers stream in; the app and website watch out |
| **backup** | every night: a database dump (kept 14 days) and a copy of all storage plus the dumps to Cloudflare R2 |

Live latency: about **1 s** over WebRTC (web), about **2–3 s** over low-latency HLS (the app).

## 1. Create the server

1. Oracle Cloud → **Compute → Instances → Create instance**.
2. Region: **Johannesburg** (or Nairobi, if your account offers it).
3. Image: **Ubuntu 24.04**. Shape: **Ampere A1 Flex**, 4 OCPU, 24 GB RAM. Boot volume: 200 GB.
4. Add your SSH key. Create.
5. **Networking → Virtual cloud network → Security list → Add ingress rules**, source `0.0.0.0/0`:
   TCP 80, TCP 443, UDP 443, TCP 1935, UDP 8189, TCP 8189.
6. Upgrade the account to **Pay-As-You-Go** before the trial ends (the free resources stay free) and set a $1 budget alert.

## 2. Point the web addresses at it

In Cloudflare DNS (or wherever the domain is), add **A records** to the server's public IP:

| Name | Cloudflare proxy |
|---|---|
| `app` | Proxied (orange) is fine |
| `media` | **DNS only (grey)**: the proxy limits uploads to 100 MB |
| `hls` | **DNS only** |
| `webrtc` | **DNS only** |
| `live` | **DNS only** (RTMP for cameras) |

## 3. Install

```bash
git clone <the repository> shekinah && cd shekinah/deploy/oracle
bash install.sh          # installs Docker, opens the firewall, makes .env and app.env
nano .env                # addresses, passwords (openssl rand -hex 24), Cloudflare backup keys
nano app.env             # copy the values from Render → Environment (JWT_SECRET, LIBRARY_ENCRYPTION_KEY, M-Pesa, Firebase…)
bash install.sh          # builds and starts everything (first build ~10 minutes)
```

`LIBRARY_ENCRYPTION_KEY` must be the **same as on Render**, or existing books and recordings can't be opened.

## 4. Move the data from Render (once)

```bash
OLD_DATABASE_URL='postgres://…supabase…' \
OLD_R2_ENDPOINT='https://<account>.r2.cloudflarestorage.com' \
OLD_R2_ACCESS_KEY_ID='…' OLD_R2_SECRET_ACCESS_KEY='…' OLD_R2_BUCKET='shekinah-sermons' \
OLD_PUBLIC_BASE_URL='https://pub-2b8b5f3f73a14e80bf09b789a9f1b87c.r2.dev' \
bash migrate-from-render.sh
```

It copies the database and every stored file, then rewrites stored file addresses from R2 to this server.

## 5. Switch the app over

1. Check `https://app.<domain>` (web admin) and a few sermons, books and covers.
2. Build the phone app with the new address and publish it:
   `SHEKINAH_API_BASE=https://app.<domain> ./gradlew :app:assembleRelease`
3. Keep Render and Supabase running for two weeks as a fallback, then switch them off.

## Going live with cameras

Web admin → **Live** → *Cameras, OBS and video switchers*:

- **OBS**: Settings → Stream → Service *Custom*, Server = the **Server** shown, Stream key = the **Stream key** shown.
- **ATEM Mini / cameras with RTMP**: paste the **Full address**.
- Pressing *Start streaming* starts the service (title and who can watch come from that page) and notifies members. Stopping ends it a minute later; the recording goes to Sermons.
- **YouTube**: on the same page, paste the YouTube stream URL and key and tick *Send every live service to YouTube*. The server forwards the same picture, so the church only uploads once.

Upload speed needed at the venue: about **4–6 Mbps** for 720p/1080p.

## Everyday

```bash
docker compose ps                         # what's running
docker compose logs -f app                # app log
git pull && docker compose up -d --build app   # update
docker compose exec backup backup.sh      # run a backup now
ls data/backups/db                        # local database dumps
```

**Restore the database** from a dump:
`docker compose exec -T postgres pg_restore -U shekinah -d shekinah --clean --no-owner < data/backups/db/<file>.dump`

## Viewers far away

Cloudflare (orange cloud) serves the web admin from the location nearest each person. Stored files and live video come straight from Johannesburg, which is close to Kenya. If many viewers are abroad later, a second live server (e.g. in Europe) can relay the stream; that is a later step.
