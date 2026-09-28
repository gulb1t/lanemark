# The Android app

Lanemark for Android is a real installed app, not a website in a frame. Its screens are this codebase's React app,
built with `vite build --mode app` and shipped inside the APK. It opens on sign-in (or straight to your classes), works
offline like the site, and talks to the live server with its own sign-in token.

## Build it

You need Java 21 and the Android SDK. [Android Studio](https://developer.android.com/studio) installs both. The build
script also finds them in `~/Android/jdk-21` and the usual SDK folders.

| Command | What it does |
| --- | --- |
| `npm run app` | Builds a test APK: `android/app/build/outputs/apk/debug/app-debug.apk` |
| `npm run app -- --install` | …and installs it on the phone plugged in by USB (USB debugging on), then opens it |
| `npm run app:keystore` | Makes the release signing key, once. **Back up** `android/lanemark-release.jks` and `android/keystore.properties`: every update must be signed with the same key |
| `npm run app -- --release` | Builds the signed release APK and the `.aab` bundle for the Play Store |

`APP_API_URL=https://… npm run app` points the app at another server. The default is https://swimtrack.fly.dev.

### Putting the test APK on your phone

- **By USB:** turn on Developer options and USB debugging, plug the phone in, then run `npm run app -- --install`.
- **By file:** send `app-debug.apk` to the phone (Drive, email, cable) and open it. Android asks once to allow installs
  from that app.

Every test APK is signed with the same shared test key (`android/app/debug.keystore`), wherever it's built, so a new
one installs over the last. The release APK uses your own key: to switch between the two, uninstall first.

### Without Android Studio

Every push that changes `Lanemark/` builds the test APK on GitHub (the **Lanemark Android** workflow). Open the run
under the repo's **Actions** tab and download `lanemark-test-apk` at the bottom: it's a zip with the APK inside.

## What's in it

| | How |
| --- | --- |
| **Fingerprint or face unlock** | The sign-in token is encrypted with a key in the phone's secure hardware (Android Keystore). With unlock on, the key only works after a fingerprint, strong face unlock or the screen lock (`VaultPlugin.java`). Adding a new fingerprint destroys the key, so the app asks for the password once. On phones whose only face unlock is the weaker kind, the check guards the token instead. The app locks at start and after time away: 1, 5 or 30 minutes, or only at start (Settings → This phone). |
| **Offline** | Same as the site: edits save on the phone (IndexedDB) and sync when there's signal. |
| **Printing report cards** | Android's print screen: any nearby printer, or Save as PDF (`DevicePlugin.java`). |
| **Spreadsheets, backups, recovery codes** | The share sheet: save to Files or Drive, email, open in Sheets. |
| **Invites** | The share sheet, with a link that opens the app on phones that have it (App Links). |
| **On deck** | The screen stays on while the attendance screen is open (can be turned off), and a small buzz on each mark. |
| **Back button** | Closes the open sheet, menu or tour first, then goes back, then leaves the app from the home screen. |
| **Look** | Same design as the site, with lighter blurs so older phones stay smooth. The status bar follows the theme. The icon (adaptive, and themed on Android 13+) and splash come from the logo. |

## How sign-in works

Browsers use an httpOnly cookie. The app sends `X-Lanemark-Client: android` on every request instead, and the server:

- answers sign-up, sign-in and the two-factor step with the session token in the body (plus the 2FA ticket, and the
  "trust this device" mark), and never sets cookies for the app;
- reads `Authorization: Bearer …` from the app, and never a cookie;
- skips the browser-only CSRF origin check for these requests (nothing is sent automatically, so there's nothing to
  forge), and answers CORS only for the app's own origins (`https://localhost`, `capacitor://localhost`), without
  credentials.

Tests: `server/test/app-client.test.ts`. The app's origin runs at `https://localhost` inside the phone.

## App Links

Pool invites (`/app/pool?code=…`) and the email links (`/verify-email`, `/reset-password`) open in the app when it's
installed. Android checks `https://swimtrack.fly.dev/.well-known/assetlinks.json`, which lists the certificates in
`server/app-links.json`. That list holds this computer's debug key (for the test APK). `npm run app:keystore` adds the
release key's fingerprint; ship the site afterwards.

## Play Store (next)

- `npm run app:keystore`, then `npm run app -- --release`, and upload the `.aab` in the Play Console.
- Data safety form: the app stores swimmers' names and notes (minors; no photos), synced to the Lanemark server. The
  privacy page already covers what's collected.
- Bump `versionCode` and `versionName` in `android/app/build.gradle` for every upload.

## iOS (planned)

`npx cap add ios`, then build in Xcode on a Mac. The server side is ready (`X-Lanemark-Client: ios`); the Vault and
Device plugins need Swift versions (Keychain + Face ID, and UIPrintInteractionController).

## Curriculum sources

- report card writing guide (item names, must-see comments, report templates)
- Lifesaving Society Swim for Life *At-a-Glance* guides (skills and distances)

Levels are presets: every class gets its own editable copy of its skills.
