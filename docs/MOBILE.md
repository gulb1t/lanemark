# Mobile plan: Android first, then iOS

Goal: a real installable app (an APK you can sideload, then Play Store), reusing this codebase instead of rewriting it.

## Approach: Capacitor

[Capacitor](https://capacitorjs.com) wraps the built web app (`dist/`) in a native Android/iOS shell with access to native APIs. It's the right fit because:

- The UI is already mobile-first: bottom tab bar, safe-area padding, bottom sheets, 44px+ tap targets.
- The app is already offline-first (IndexedDB cache + sync queue), which is exactly what a native app needs.
- One codebase for web, Android and iOS. React Native would mean rewriting every screen.

## What's already done

- Responsive layouts, bottom tab bar, `env(safe-area-inset-*)` padding, vaul bottom sheets on phones
- PWA manifest and icons (`public/manifest.webmanifest`); the site can already be "installed" from Chrome on Android
- `VITE_API_URL` support in `src/lib/api.ts`, so a bundled app can talk to a remote server
- Offline sync engine that survives app restarts (IndexedDB)

## Phase 1: Android APK

1. `npm i @capacitor/core @capacitor/cli @capacitor/android` then `npx cap init SwimTrack app.swimtrack --web-dir dist`
2. `npx cap add android`
3. Build with the deployed API URL: `VITE_API_URL=https://your-domain npm run build && npx cap sync android`
4. Open in Android Studio (`npx cap open android`) and choose **Build → Build APK(s)**. The APK is sideloadable.

### Auth in the native app

The web app uses httpOnly cookies. Inside Capacitor the app runs on `https://localhost`, so the API is cross-site. Two options:

- **Recommended: bearer tokens for native.** Add `POST /api/auth/token` flows that return the session token in the body when a `X-Client: native` header is present. Store it with `@capacitor/preferences` (or the encrypted `capacitor-secure-storage` plugin) and send it as `Authorization: Bearer …`. The server's `requireUser` accepts either a cookie or a bearer token. CSRF checks don't apply to bearer requests, since they aren't sent automatically by the browser.
- **Alternative:** `CapacitorHttp` (native HTTP stack) keeps cookies in the native jar. It's simpler, but less explicit.

Either way, add `https://localhost` (Android) and `capacitor://localhost` (iOS) to `APP_ORIGINS`.

### Native niceties

| Feature | Plugin |
| --- | --- |
| Status bar colour follows the theme | `@capacitor/status-bar` |
| Haptic tick when marking attendance or passing a skill | `@capacitor/haptics` |
| Camera for swimmer photos | `@capacitor/camera` (`fileToAvatar` already downsizes) |
| Share/print report cards as PDF | `@capacitor/share` + a PDF export |
| Keep the screen awake while taking attendance | `@capacitor-community/keep-awake` |
| App icon and splash | `@capacitor/assets` generated from `public/icon.svg` |
| Biometric unlock of the stored token | `@aparajita/capacitor-biometric-auth` |

## Phase 2: Play Store

- Signed release build (keystore), target SDK per Play policy, privacy policy page (the app stores minors' names and photos, so the data safety form matters)
- Crash reporting (Sentry) and an in-app "export my data" (already exists as JSON backup)

## Phase 3: iOS

`npx cap add ios`, build in Xcode on a Mac, TestFlight, then App Store. Same auth approach (bearer + Keychain storage). Apple requires in-app account deletion, which already exists in Settings.

## Server changes needed before shipping mobile

- Bearer-token auth path (above) and its tests
- Email verification and password reset (needs an email provider, e.g. Resend or Postmark)
- Optional: passkeys (WebAuthn) as a phishing-proof alternative to passwords
