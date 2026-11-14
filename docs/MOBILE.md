# Mobile apps (Android / iOS)

The phone apps are a Capacitor shell around the built web app (ADR-037). All app code lives in `apps/web`; `apps/mobile` holds only the native projects.

## Every change
```
pnpm --filter @hd/mobile sync      # build apps/web and copy it into android/ and ios/
pnpm --filter @hd/mobile apk       # Android debug APK -> apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

## Android (Windows / Mac / Linux)
- Needs the Android SDK (Android Studio installs it) and a JDK 17-21. `scripts/apk.mjs` uses Android Studio's bundled JDK automatically (Gradle cannot run on Java 25).
- `android/local.properties` (not in git) points at the SDK: `sdk.dir=C\:\\Users\\<you>\\AppData\\Local\\Android\\Sdk`.
- Install on a phone (USB debugging on): `adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`, or open the project in Android Studio: `pnpm --filter @hd/mobile android`.
- A store build (signed `.aab`) needs the owner's upload key and Play Console account (P4-05).

## iOS (Mac only)
- Needs a Mac with Xcode. The project uses Swift Package Manager (no CocoaPods). After `sync`, open `apps/mobile/ios/App/App.xcodeproj`, pick a team, run.
- TestFlight / App Store need the owner's Apple developer account (P4-05).

## Icons and launch screen
- Sources in `apps/mobile/assets/` (icon on paper, adaptive foreground / background, dark launch screen). Regenerate all sizes after changing them: `pnpm --filter @hd/mobile assets`.

## Inside the app (`apps/web/src/lib/native.ts`)
- No service worker (files are on the phone).
- Android Back closes the open sheet / card / mode / tool / selection first (it sends the app's Esc), and only leaves (minimises) the app when nothing is open.
- Status bar: dark during the dark splash, paper colours in the workspace.
- The native launch screen stays until the web splash has painted.
- `html[data-native="android" | "ios"]` is set, for native-only CSS.
- App id `in.senevon.plotframer` (owner can change it before the first store upload, never after).
