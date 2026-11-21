# Android APK Build Guide — KBR Smart Calculator Pro

This guide explains how to package **KBR Smart Calculator Pro** into an installable Android `.apk` (and Google Play `.aab`) using **Capacitor** (recommended for native camera/microphone permissions and offline bundle) or **Bubblewrap (TWA)**.

---

## Option 1: Build Native-Wrapped Android APK with Capacitor (Recommended)

### Prerequisites
- **Android Studio** (Ladybug or newer) with Android SDK Platform 34+
- **JDK 17+**
- **Deployed Backend URL** (e.g., your Cloud Run / Express server URL so `/api/math/*` calls reach Gemini securely from the Android app)

### Steps

1. **Build the web bundle**
   ```bash
   npm install
   npm run build
   ```

2. **Install Capacitor**
   ```bash
   npm install @capacitor/core @capacitor/cli @capacitor/android
   npx cap init "KBR Smart Calculator Pro" "com.kbrtech.smartcalcpro" --web-dir dist
   ```

3. **Configure API Base URL for mobile WebView**
   If hosting the Express backend (`server.ts`) at `https://your-kbr-backend.run.app`, set `VITE_API_BASE_URL=https://your-kbr-backend.run.app` before running `npm run build` so API calls from `capacitor://localhost` route to your backend.

4. **Add Android platform & permissions**
   ```bash
   npx cap add android
   ```
   In `android/app/src/main/AndroidManifest.xml`, ensure these permissions are declared:
   ```xml
   <uses-permission android:name="android.permission.CAMERA" />
   <uses-permission android:name="android.permission.RECORD_AUDIO" />
   <uses-permission android:name="android.permission.INTERNET" />
   <uses-permission android:name="android.permission.VIBRATE" />
   <uses-feature android:name="android.hardware.camera" android:required="false" />
   <uses-feature android:name="android.hardware.camera.flash" android:required="false" />
   ```

5. **Sync and open in Android Studio**
   ```bash
   npx cap sync android
   npx cap open android
   ```

6. **Generate Debug or Signed Release APK**
   - In Android Studio: **Build > Build Bundle(s) / APK(s) > Build APK(s)** (for testing) or **Generate Signed Bundle / APK** (for Play Store release).
   - Or via Gradle CLI:
     ```bash
     cd android
     ./gradlew assembleDebug
     ```
     Your APK will be generated at:
     `android/app/build/outputs/apk/debug/app-debug.apk`

---

## Option 2: Installable Android PWA / Trusted Web Activity (Bubblewrap)

Because KBR Smart Calculator Pro includes a complete Web App Manifest (`/manifest.webmanifest`), Service Worker, and 192x192 / 512x512 / maskable PNG icons:

1. **Direct Chrome on Android Install**:
   Open the hosted HTTPS URL in Chrome on Android and tap **Install App** inside Settings or the browser prompt.
2. **Play Store APK via Bubblewrap**:
   ```bash
   npm install -g @bubblewrap/cli
   bubblewrap init --manifest https://your-hosted-url/manifest.webmanifest
   bubblewrap build
   ```
   This outputs `app-release-signed.apk` ready for Android devices.

---

## Configuring the Gemini API Key

1. Obtain an API key from **Google AI Studio**.
2. Set `GEMINI_API_KEY` as a server environment variable on your Express host (or in **Settings > Secrets** inside Google AI Studio Build).
3. Verify `/api/health` returns `"aiConfigured": true`.
4. Never embed `GEMINI_API_KEY` inside Android client assets or `VITE_*` variables.
