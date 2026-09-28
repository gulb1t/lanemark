import type { CapacitorConfig } from '@capacitor/cli'

/**
 * The Android app. Its screens are this web app, built with `npm run app:build` into dist-app/ and shipped inside
 * the APK (nothing loads from the website). It talks to the live API with a bearer token; see docs/MOBILE.md.
 */
const config: CapacitorConfig = {
  appId: 'io.github.gulb1t.swimtrack',
  appName: 'SwimTrack',
  webDir: 'dist-app',
  android: {
    // Lets the server's sessions list say "SwimTrack app on Android".
    appendUserAgent: 'SwimTrackApp/1.0',
    backgroundColor: '#060709',
    // Only for testing against a server on your computer (APP_API_URL=http://10.0.2.2:8787 in the emulator).
    allowMixedContent: process.env.APP_API_URL?.startsWith('http:') ?? false,
  },
  plugins: {
    // Hidden by the app once the first screen has drawn, so there's no white flash.
    SplashScreen: { launchAutoHide: false, backgroundColor: '#060709', showSpinner: false },
    SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover' },
    Keyboard: { resizeOnFullScreen: true },
  },
}

export default config
