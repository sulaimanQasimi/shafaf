# Android Setup

How to set up your machine and project to build the **Android** version of **شفاف (Shafaf)**. See also [ANDROID_SETUP.md](../ANDROID_SETUP.md) in the repo.

---

## Prerequisites

1. **JDK 17+**  
   - e.g. [Adoptium](https://adoptium.net/)  
   - Set `JAVA_HOME`

2. **Android SDK**  
   - [Android Studio](https://developer.android.com/studio) or SDK Command Line Tools  
   - Set `ANDROID_HOME`  
   - Add `$ANDROID_HOME/platform-tools` and `$ANDROID_HOME/tools` to `PATH`

3. **Android NDK**  
   - Via Android Studio SDK Manager or [NDK downloads](https://developer.android.com/ndk/downloads)  
   - Recommended: r25c or newer  
   - Set `ANDROID_NDK_HOME` if needed

4. **Rust Android targets**
   ```bash
   rustup target add aarch64-linux-android
   rustup target add armv7-linux-androideabi
   rustup target add i686-linux-android
   rustup target add x86_64-linux-android
   ```

5. **cargo-ndk**
   ```bash
   cargo install cargo-ndk
   ```

---

## Android Config in the Project

In `src-tauri/tauri.conf.json`:

- **Identifier**: `com.sulaiman.shafaf` (package name for Android)
- **`bundle.android`**:
  - `minSdkVersion`: 24 (Android 7.0)
  - `versionCode`: incremented for each release

To change package name: set the root `identifier`. To change minSdk or versionCode: edit `bundle.android`.

---

## Initialize Android Project

Before the first Android build:

```bash
npm run tauri android init
```

This creates `src-tauri/gen/android/`, installs Rust Android targets if needed, and generates the Android project. Only needed once, or after deleting `gen/android/`.

---

## Local Builds

### Development (run on device/emulator)

```bash
npm run tauri android dev
```

Builds, installs, and runs the app.

### Production (APK/AAB)

```bash
npm run tauri android build
```

Outputs:

- **APK**: `src-tauri/target/android/apk/release/`
- **AAB**: `src-tauri/target/android/aab/release/`

### Build a specific ABI

```bash
npm run tauri android build -- --target aarch64-linux-android
npm run tauri android build -- --target armv7-linux-androideabi
npm run tauri android build -- --target x86_64-linux-android
```

---

## Signing

### Local release signing

1. Create a keystore:
   ```bash
   keytool -genkey -v -keystore shafaf-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias shafaf
   ```

2. Point the build to it via environment variables (or `build.gradle.kts` / `tauri.conf.json` if you’ve wired it):
   - `KEYSTORE_PATH`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`

Do **not** commit the keystore or passwords.

### CI (GitHub Actions)

The release workflow creates a **CI keystore** at `src-tauri/gen/android/ci.keystore` and sets:

- `KEYSTORE_PATH`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`

So Android release builds in CI are signed without using your production keystore. See [Building and Release](Building-and-Release) and `.github/workflows/release.yml`.

---

## Device / Emulator

- **Physical device**: enable Developer options and USB debugging, connect via USB, then run `npm run tauri android dev`.
- **Emulator**: create an AVD in Android Studio, start it, then run `npm run tauri android dev`.

---

## Database on Android

- The app uses the private data directory for SQLite. Paths differ from desktop; `src-tauri` handles this.
- If you use `ANDROID_DATABASE_PATH` or similar, set it in `.env` or the environment when relevant.

---

## Troubleshooting

| Issue | What to check |
|-------|----------------|
| NDK not found | `ANDROID_NDK_HOME`, or NDK path in Android config |
| Java not found | JDK 17+, `JAVA_HOME`, `java -version` |
| `SigningConfig "release" is missing storeFile` | CI: ensure the workflow creates the keystore and sets `KEYSTORE_PATH` (and related). Local: set `KEYSTORE_PATH` (and keys) or use debug. |
| App crashes on start | `adb logcat`, permissions, database path |
| Database errors | App-private paths, `lib.rs` Android handling |

More: [Troubleshooting](Troubleshooting).

---

## Related

- [ANDROID_SETUP.md](../ANDROID_SETUP.md)  
- [Building and Release](Building-and-Release)  
- [Troubleshooting](Troubleshooting)  
