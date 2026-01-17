# Android Setup Guide

This guide will help you set up and build the Android version of the Finance app.

## Prerequisites

Before building for Android, you need to install the following:

1. **Java Development Kit (JDK) 17 or higher**
   - Download from: https://adoptium.net/
   - Set `JAVA_HOME` environment variable

2. **Android SDK**
   - Install Android Studio: https://developer.android.com/studio
   - Or install Android SDK Command Line Tools
   - Set `ANDROID_HOME` environment variable
   - Add `$ANDROID_HOME/platform-tools` and `$ANDROID_HOME/tools` to your PATH

3. **Android NDK (Native Development Kit)**
   - Install via Android Studio SDK Manager
   - Or download from: https://developer.android.com/ndk/downloads
   - Recommended version: r25c or higher

4. **Rust Android targets**
   ```bash
   rustup target add aarch64-linux-android
   rustup target add armv7-linux-androideabi
   rustup target add i686-linux-android
   rustup target add x86_64-linux-android
   ```

5. **cargo-ndk** (for building Rust code for Android)
   ```bash
   cargo install cargo-ndk
   ```

## Configuration

The Android configuration is already set up in `src-tauri/tauri.conf.json`:

- **Package Name**: `com.sulaiman.financeapp` (derived from `identifier`)
- **Version Code**: 1 (increment for each release)
- **Min SDK Version**: 24 (Android 7.0)

### Customizing Android Configuration

Edit `src-tauri/tauri.conf.json` to modify:

- **Package Name**: Change the root `identifier` field (e.g., `"identifier": "com.yourcompany.yourapp"`)
- **Version Code**: Increment `bundle.android.versionCode` for each release
- **Min SDK**: Change `bundle.android.minSdkVersion` (minimum: 24)
- **Auto-increment Version Code**: Set `bundle.android.autoIncrementVersionCode` to `true` to automatically increment version code on each build

Note: In Tauri 2.0, Android configuration goes under `bundle.android`, not `app.android`. The package name comes from the `identifier` field, and most Android-specific settings (permissions, target SDK, etc.) are handled automatically or can be customized in the generated Android project files.

## Initializing Android Project

Before building for Android, you need to initialize the Android project structure:

```bash
npm run tauri android init
```

This command will:
- Create the Android Studio project directory (`src-tauri/gen/android/`)
- Install required Rust Android targets automatically
- Generate all necessary Android configuration files

**Note**: You only need to run this once, or if you delete the `src-tauri/gen/android/` directory.

## Building for Android

### Development Build

```bash
npm run tauri android dev
```

This will:
1. Build the frontend
2. Compile Rust code for Android
3. Build the Android APK
4. Install and run on connected device/emulator

### Production Build

```bash
npm run tauri android build
```

This creates a signed APK or AAB (Android App Bundle) in `src-tauri/target/android/apk/` or `src-tauri/target/android/aab/`.

### Build Specific Architecture

```bash
# Build for ARM64 (most modern devices)
npm run tauri android build -- --target aarch64-linux-android

# Build for ARMv7 (older devices)
npm run tauri android build -- --target armv7-linux-androideabi

# Build for x86_64 (emulators)
npm run tauri android build -- --target x86_64-linux-android
```

## Testing on Device/Emulator

### Using Physical Device

1. Enable Developer Options on your Android device
2. Enable USB Debugging
3. Connect device via USB
4. Run: `npm run tauri android dev`

### Using Android Emulator

1. Create an Android Virtual Device (AVD) in Android Studio
2. Start the emulator
3. Run: `npm run tauri android dev`

## Signing the App

For production releases, you need to sign your APK/AAB:

1. Generate a keystore:
   ```bash
   keytool -genkey -v -keystore finance-app-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias finance-app
   ```

2. Configure signing in `src-tauri/tauri.conf.json`:
   ```json
   "android": {
     "signingConfig": {
       "keystore": "path/to/finance-app-key.jks",
       "keyAlias": "finance-app",
       "keyPassword": "your-key-password",
       "storePassword": "your-store-password"
     }
   }
   ```

⚠️ **Important**: Never commit your keystore file or passwords to version control!

## Troubleshooting

### Build Fails with "NDK not found"
- Ensure Android NDK is installed
- Set `ANDROID_NDK_HOME` environment variable
- Or specify NDK path in `tauri.conf.json`

### Build Fails with "Java not found"
- Install JDK 17 or higher
- Set `JAVA_HOME` environment variable
- Verify: `java -version`

### App Crashes on Launch
- Check Android logs: `adb logcat`
- Ensure all required permissions are granted
- Verify database path is accessible on Android

### Database Issues on Android
- Android uses different file paths than desktop
- Database path should be in app's private directory
- Check `src-tauri/src/lib.rs` for Android-specific path handling

## Environment Variables for Android

Create a `.env` file in the project root:

```env
# Android-specific database path
ANDROID_DATABASE_PATH=/data/data/com.sulaiman.financeapp/databases/db.sqlite
```

## Additional Resources

- [Tauri Mobile Documentation](https://tauri.app/v2/guides/mobile/)
- [Android Developer Guide](https://developer.android.com/)
- [Rust on Android](https://mozilla.github.io/firefox-browser-architecture/experiments/2017-09-21-rust-on-android.html)
