# Claritard mobile

React Native client for the productivity app, built with Expo SDK 57 and Expo Router. It shares the Spring Boot API and Keycloak realm with the web frontend.

## What is included

- Native Keycloak email/password sign-in, encrypted refresh-token storage, token refresh, and logout
- Today dashboard, day rating, task creation/editing/completion, and the full in-row Pomodoro focus flow
- Task, calendar event, mental thread, mental-state, meditation, note, and stat workflows
- Shared Raleway typography, web palette, four accent colors, light/dark/system themes, soft cards, and task-priority colors
- Durable notification recovery from the backend, presented through native notifications when permission is available

## First-time setup

Use Node 22.13 or newer, then install dependencies:

```bash
cd frontend/mobile
npm install
```

In Keycloak, add `solife://auth` to the `productivity-app-frontend` client's valid redirect URIs and enable Direct Access Grants for the public client. The native form uses the realm's password grant; no client secret belongs in the app.

The mobile app has explicit environment guards. A local native build uses the
`EXPO_PUBLIC_*` values from `.env.local`; the `preview` and `production` EAS
profiles use the deployed HTTPS origins defined in `eas.json`. A preview or
production build will fail rather than silently connecting to `localhost`.

## Android host prerequisites

`npm run android` needs the Android SDK and `adb` on the development computer.
Install Android Studio, then use its SDK Manager to install Android SDK
Platform-Tools, Android SDK Command-line Tools, and an Android SDK Platform.
Create an emulator there, or connect a phone with USB debugging enabled.

Use Java 21 for the Gradle JDK in Android Studio. The React Native native build
currently fails under Java 25 when AGP reads the CMake/Prefab output, because
Java 25 reports restricted native access on the error stream. Keep Android
Studio's Gradle JDK and `JAVA_HOME` pointed at the same Java 21 installation.
For this Linux development machine, verify the terminal that runs Expo with:

```bash
export JAVA_HOME=/home/leisure/.sdkman/candidates/java/21.0.2-open
export PATH="$JAVA_HOME/bin:$PATH"
java -version                    # must report 21
./android/gradlew --version      # JVM must report 21
```

The generated Android project also pins its local Gradle daemon to this Java 21
installation, so Android Studio's Java 25 launcher cannot select the failing
runtime. Re-run these settings after regenerating `android/` with Expo.

On Linux, Android Studio normally installs the SDK at
`/home/your-user/Android/Sdk`. Set the actual path shown in Android Studio's SDK
Manager, then restart the terminal:

```bash
export ANDROID_HOME=/home/your-user/Android/Sdk
export ANDROID_SDK_ROOT=/home/your-user/Android/Sdk
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
```

Confirm the setup before running the app:

```bash
adb version
adb devices
```

Start the backend, PostgreSQL, Keycloak, Metro, and the native Android app from
the repository root:

```bash
./run-app.sh
```

`run-app.sh` uses an already-connected device when possible. If no device is
connected and exactly one AVD is configured, it starts that emulator with two
virtual cores and 2 GB RAM, waits for boot, applies the required reverse port
forwarding for the local Keycloak issuer, backend, and Metro server, then
builds and launches the Android development app. Multiple AVDs require
`CLARITARD_ANDROID_AVD`; set `CLARITARD_ANDROID_EMULATOR=0` to keep emulator
startup manual. If the emulator is started after `run-app.sh`, apply the
mappings manually:

```bash
adb reverse tcp:7070 tcp:7070
adb reverse tcp:8080 tcp:8080
adb reverse tcp:8081 tcp:8081
```

The native build is intentionally conservative to keep the host responsive:
it uses two Gradle/CMake workers, reduced process priority, a 1536 MB Gradle
heap, and no persistent Gradle daemon. Override the defaults with
`CLARITARD_MOBILE_GRADLE_WORKERS`, `CLARITARD_MOBILE_GRADLE_MAX_HEAP`, or
`CLARITARD_MOBILE_BUILD_NICE`; set `CLARITARD_MOBILE_ANDROID=0` to run only
the web stack and Metro.

### Node version mismatch during Gradle builds

If `nvm use 22` selects Node 22 but `:expo-constants:createExpoConfig` fails
with `parseEnv is not a function` and prints Node 18, restart the existing
Gradle daemon after selecting Node. Its child processes can still resolve
the old Node executable even when Fish and Expo use the new version.

From `frontend/mobile`, these commands work in Fish with the configured
NVM/Bass bridge:

```fish
nvm use 22
node -p 'process.version + " " + process.execPath'
./android/gradlew --stop
npm run android
```

`--stop` stops this user's daemons for the wrapper's Gradle version. The next
build starts a fresh daemon using the current environment; it preserves
dependencies and build caches. Compare the Node version in the failing task
with the terminal's version before changing shell configuration.

OAuth requires the app's custom `solife` scheme, so use a development/native build rather than Expo Go. An iOS simulator can use the loopback defaults directly; building iOS requires macOS. Physical iOS devices should point `.env.local` at deployed HTTPS API and Keycloak URLs.

For a deployed environment, the EAS `preview` and `production` profiles already
provide the public origins. Verify that they match the server before building.
If you run a production-like build locally, copy `.env.example` to `.env.local`,
set `EXPO_PUBLIC_APP_ENV=production`, and replace both service URLs with their
public HTTPS origins. The Keycloak URL must match the issuer configured on the
backend.

## Validation

```bash
npm run lint
npm run typecheck
npm run export:android
```

## Production APK build

The repository-root `build-production-apk-to-drive.sh` builds the production
environment APK and stores it in `Documents/productivity-app-apks`:

```bash
cd ../..
./build-production-apk-to-drive.sh
```

Override the destination with `CLARITARD_APK_OUTPUT_DIR`, or set
`CLARITARD_APK_NAME` to choose the filename. Pass `--dry-run` to build and
verify the APK path without copying it. The generated release variant
currently uses the local debug keystore in `android/app/build.gradle`;
configure a private release keystore before distributing the APK as a
production-signed artifact.

## CI Android builds

The GitHub Actions workflow runs the validation commands above for every change,
then queues an EAS Android `preview` build after a successful production deploy
on `master` or a manual workflow run. The preview profile is an internal,
installable build configured with the deployed API and Keycloak origins. The
same workflow publishes a `preview` OTA update for compatible JavaScript-only
mobile changes after the deployment succeeds.

One-time EAS setup is required before the workflow can build:

```bash
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest build --platform android --profile preview
```

Commit the EAS configuration that links the app to the Expo project, then add an
`EXPO_TOKEN` repository secret in GitHub. The workflow prints the EAS build link;
download the finished APK from that build and install it on the phone. The
production Play Store build can use the existing `production` profile later.

After that first OTA-capable APK is installed, normal changes under
`src/` can reach the phone from a push to `master` without reinstalling. The
workflow deliberately skips OTA publication when `app.json`, `eas.json`, or the
mobile dependency manifests change; those changes require installing the new
APK produced by the workflow. Keep the app version/runtime version compatible
for JavaScript-only updates.

## Structure

- `src/app/` — protected routes, bottom tabs, and feature screens
- `src/components/` — native design-system and feature components
- `src/providers/` — Keycloak session, theme, and notifications
- `src/services/api.ts` — typed authenticated API client shared by every screen
- `src/types/models.ts` — frontend view of backend contracts

## Current mobile-specific limits

- Calendar uses a touch-friendly upcoming agenda instead of FullCalendar's desktop month grid.
- Notes use a plain-text editor. Existing rich HTML is readable as text, but saving it from mobile simplifies that formatting.
- The sign-in screen is native and submits credentials to Keycloak without storing the password. Logout still returns through the `solife` callback scheme.
- Meditation bundles the shared web soundscape choices and uses a singing-bowl recording for interval bells. Session state and timing still persist through the backend.
- Notes remain dependent on the planned notes backend, just like the current web Notes page.
