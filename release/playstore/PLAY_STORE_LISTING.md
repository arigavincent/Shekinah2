# Shekinah Sons Global: Google Play submission pack

Upload file: `release/artifacts/shekinah-2.4.4-play.aab` (version 2.4.4, code 35, Play build).
The Play build has no in-app purchase of digital content (paid books, paid recordings, paid lives); Google requires its own billing for those. Giving and event tickets work as normal. Items members already own still open.

## 1. Store listing

**App name** (30 max): `Shekinah Sons Global`

**Short description** (80 max):
`Sermons, live services, the Bible and reading plans from Shekinah Sons Global.`

**Full description** (4,000 max):

```
Shekinah Sons Global is the home of our church family, wherever you are.

WATCH AND LISTEN
• Video and audio sermons with bright covers, notes and Bible references you can tap
• Live services with live chat, and a countdown to the next service
• Replays of every service, ready after the broadcast
• Make your own playlists, shuffle and repeat, and download sermons to listen offline
• Sermons also play from the church's YouTube channel inside the app

THE BIBLE
• The whole Bible offline: the Berean Standard Bible in English and Kiswahili, side by side
• Choose your reading font and text size
• Listen to the whole Bible read by Bob Souer, verse by verse, and download it to listen offline
• Highlights, notes, bookmarks and search
• Reading plans with a daily reading, reflection and prayer, and streaks
• A new verse every morning on the home screen

GROW TOGETHER
• Prayer wall: share a request, pray for others, mark it answered
• Testimonies of what God has done
• Community chat
• Daily devotionals and church updates

CHURCH LIFE
• Events with registration and tickets
• QR check-in at services and events
• Serve teams: ask to join a ministry team
• Giving with M-Pesa

Your account is protected and you can delete it at any time from your profile.
```

**App category:** Lifestyle (or Books & Reference). **Tags:** Church, Bible, Religion.
**Contact email:** the church's public email. **Website:** the church site (optional).
**Privacy policy URL:** `https://shekinah-sons-global.onrender.com/privacy`
(After the move to Oracle: `https://<app domain>/privacy`.)

**Graphics needed**
- App icon 512×512 PNG (from the dove logo).
- Feature graphic 1024×500 PNG.
- Phone screenshots, 2–8, e.g. Home, Sermons, a sermon with notes, Bible, Reading plan, Live, Events, Prayer wall.

## 2. App content forms (Play Console → Policy → App content)

**Privacy policy:** the URL above.

**App access:** "All or some functionality is restricted." Give Google a reviewer account:
create a normal member account (e.g. `playreview@<church domain>`, strong password, phone number filled in) and paste its email and password in the form. Do not use an admin account.

**Ads:** No, the app does not contain ads.

**Content rating questionnaire:** Category *Reference, news or educational* / *Social*.
Answer **Yes** to "users can interact or communicate" (community chat, live chat, prayer wall) and **No** to sharing location. No violence, sexual content, gambling or drugs. Expect rating **Everyone / PEGI 3** with "Users interact".

**Target audience:** 13+ (choose 13–17 and 18+). Not designed for children under 13.

**News app:** No.

**Data safety** (what to tick):

| Data type | Collected | Shared | Why | Optional? |
|---|---|---|---|---|
| Name | Yes | No | Account management, app functionality | Required |
| Email address | Yes | No | Account management | Required |
| Phone number | Yes | No | Account management, app functionality (check-ins) | Required |
| Messages (in-app: chat, prayer requests, testimonies) | Yes | No | App functionality | Optional |
| Purchase history (gifts, tickets) | Yes | Yes (payment provider) | App functionality, account management | Optional |
| Audio / video (only for staff who go live) | Yes | No | App functionality | Optional |
| App interactions (viewer counts, check-ins) | Yes | No | App functionality, analytics | Required |
| Device or other IDs (push token) | Yes | Yes (Firebase) | App functionality | Optional |

- Data is **encrypted in transit**: Yes.
- Users can **request deletion**: Yes, in the app (Profile → Delete my account) and at `https://shekinah-sons-global.onrender.com/delete-account`.

**Account deletion URL** (asked separately): `https://shekinah-sons-global.onrender.com/delete-account`

**Foreground services** (Play asks why each is used; record a short screen video for each):
- *Camera, microphone, media projection*: "Staff broadcast the church's live service from the phone; the broadcast keeps running while the screen is shared or the app is in the background."
- *Media playback*: "Sermons and audio keep playing in the background and from the lock screen."
- *Data sync*: "Downloading sermons and books for offline use continues if the app is closed."

**Permissions:** Camera and microphone (live broadcasting, QR check-in scanning), notifications.

**Financial features declaration:** the app takes donations and event payments through M-Pesa (no lending, trading or crypto).

## 3. App signing (important)

Choose **"Use my own key / Export and upload a key from Java keystore"** in Play App Signing and upload the **ministry key** (`SHA-256 5D:28:C2:E2:37:0F:93:4D:8B:A6:9B:1D:CD:52:2B:64:B1:D8:45:4F:91:87:84:48:2B:52:BB:F5:EA:C2:69:4E`).
Then people who installed the APK from the link can update from the Play Store without uninstalling. If Google generates a new key instead, those people must uninstall the link version first.
Keep the keystore and its passwords backed up offline; losing them means the app can never be updated.

## 4. Release steps

1. Pastor's account: identity and Android-device verification done, A&J invited as admin.
2. **Create app** → name, default language English, App, Free.
3. Complete every item under **App content** (above) and the **Store listing**.
4. **Testing → Closed testing**: create a track, add the testers' Gmail list, upload the AAB, roll out. Share the opt-in link with the 18–20 testers.
5. Wait **14 days** with at least 12 testers opted in, then **Apply for production** and answer the questions about the test.
6. **Production → Create release**, same AAB (or a newer one), roll out. Review usually takes a few days.

## 5. Release notes (first release)

```
Welcome to the Shekinah Sons Global app: sermons and live services, the Bible in English and Kiswahili with audio, reading plans, prayer wall, testimonies, events with check-in, playlists and offline listening.
```
