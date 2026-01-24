# Troubleshooting

Common issues and fixes for **شفاف (Shafaf)** when building, running, or releasing.

---

## Build

### `npm run build` or `npm run tauri build` fails

- **TypeScript / Vite errors**: run `npm run build` alone and fix reported TS or missing modules.
- **Rust errors**: run `cargo build --manifest-path src-tauri/Cargo.toml` and fix compile errors.
- **Tauri “frontend dist”**: ensure `npm run build` succeeds and `vite.config.ts` outputs to the path Tauri expects (e.g. `../dist` in `tauri.conf.json`).

### Version mismatch

- Release or packaging errors can come from different versions in `package.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`. Keep `version` in sync when cutting releases.

---

## Tauri / Desktop

### Window doesn’t open or shows a blank screen

- Check devtools / console for JS errors.
- Ensure `beforeDevCommand` / `devUrl` (dev) or `frontendDist` (build) in `tauri.conf.json` are correct.
- On first run, firewall or antivirus can block; allow the app.

### Database not found or “unable to open”

- Check `DATABASE_PATH` in `.env` and that the directory exists and is writable.
- On Windows, avoid paths with problematic characters; try `E:/db.sqlite` or `E:\\db.sqlite`.
- Ensure no other process has the DB file locked.

---

## Android

### NDK not found

- Install NDK (r25c or newer) via SDK Manager or [NDK downloads](https://developer.android.com/ndk/downloads).
- Set `ANDROID_NDK_HOME` or the path your toolchain expects.
- In CI, the `setup-android` or similar action usually sets `ANDROID_NDK_ROOT` / `ANDROID_NDK_HOME`.

### Java not found

- Install JDK 17+ and set `JAVA_HOME`.
- Run `java -version` and `javac -version` to confirm.

### `SigningConfig "release" is missing required property "storeFile"`

- **CI**: The release workflow must create a keystore and set `KEYSTORE_PATH`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` before `npm run tauri android build`. See [Building and Release](Building-and-Release) and [Android Setup](Android-Setup).
- **Local**: Set the same env vars to a valid keystore, or ensure `build.gradle.kts` uses `debug` when no release keystore is configured.

### App crashes on launch (Android)

- Run `adb logcat` and filter by your package (`com.sulaiman.shafaf`) or “tauri”.
- Check: runtime permissions, storage/database path, and that the project was initialized with `npm run tauri android init` if `gen/android` was missing.

### Database issues on Android

- The app uses the private app directory; paths differ from desktop. See `src-tauri/src/lib.rs` for Android-specific logic.
- Don’t rely on a desktop `DATABASE_PATH` on device; use the app’s internal path.

---

## GitHub Release Workflow

### Release or artifacts not created

- **Permissions**: workflow needs `permissions: contents: write` for the job that creates/updates the release.
- **Tag**: must match `v*` (e.g. `v6.3.2`) and be pushed to the default branch (usually `main`/`master`).
- **GITHUB_TOKEN**: provided by Actions; no extra secret for basic release upload.

### Android job fails in CI

- Ensure `build-android` runs after `build-windows` if it depends on the same release.
- Check that the CI keystore step runs and `KEYSTORE_PATH` points to the generated `ci.keystore`.
- Logs: Actions → select run → “Build Android” job.

### “Resource not accessible by integration”

- The default `GITHUB_TOKEN` can create releases only when **Settings → Actions → General → Workflow permissions** allows “Read and write” (or at least write for `contents`). Set it and re-run.

---

## License

### License screen every time / “invalid license”

- License is **machine-bound**. If the machine ID changes (e.g. CPU, hostname, RAM), an old key may no longer validate.
- Generate a new key with `license-generator.html` using the **current** Machine ID from the app.
- Stored key is in the system keyring (`finance_app` / `license_key`). If the keyring is reset or not available, the app will ask for a key again.

### `license-generator.html` doesn’t run or produces wrong key

- The generator must use the **same** algorithm and secrets as the Rust `license` module. If `SECRET_KEY_BASE` or `SALT` were changed in `src-tauri/src/license.rs`, update the HTML to match.
- Open `license-generator.html` in a modern browser (needs `crypto.subtle`). Do not run from `file://` if the page expects a server; a simple HTTP server or opening from a hosted page is safer.

---

## Getting More Help

- **Tauri**: [Tauri docs](https://tauri.app/v1/), [Tauri v2](https://v2.tauri.app/), [mobile](https://tauri.app/v2/guides/mobile/).
- **Rust / Android**: [Rust on Android](https://mozilla.github.io/firefox-browser-architecture/experiments/2017-09-21-rust-on-android.html).
- **Actions**: [GitHub Actions for releases](https://docs.github.com/en/actions).

---

## Related

- [Building and Release](Building-and-Release)  
- [Android Setup](Android-Setup)  
- [Configuration](Configuration)  
- [License](License)  
