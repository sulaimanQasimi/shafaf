# Installation

This page describes how to install **شفاف (Shafaf)** on **Windows** and **Android** from GitHub Releases.

---

## Windows

1. Open [Releases](https://github.com/YOUR_ORG/tauri-app/releases) and pick the version you need (e.g. `v6.3.2`).
2. Download the **NSIS installer** (`.exe`), e.g.  
   `شفاف_6.3.2_x64-setup.exe` or similar.
3. Run the installer and follow the steps.
4. Launch **شفاف** from the Start menu or desktop shortcut.

**Built artifacts**: `src-tauri/target/release/bundle/nsis/`

---

## Android

1. Open [Releases](https://github.com/YOUR_ORG/tauri-app/releases) and pick the version (e.g. `v6.3.2`).
2. Download the **APK** (for direct install).
3. On the device:
   - Enable **Install from unknown sources** (or **Install unknown apps** for the browser/file manager you use).
   - Open the downloaded APK and install.
4. Launch **شفاف** from the app drawer.

**Note**: For **Google Play**, use the **AAB** (Android App Bundle) from the same release; it is not for direct installation on devices.

**Built artifacts**:  
- APK: `src-tauri/target/android/apk/release/`  
- AAB: `src-tauri/target/android/aab/release/`

---

## Requirements

- **Windows**: 64-bit Windows 10/11.
- **Android**: Android 7.0 (API 24) or higher.

---

## First Launch

- On first run you will see the **License** screen. Enter a valid license key (see [License](License)), then **Login** (see [Getting Started](Getting-Started)).

---

## Related

- [Getting Started](Getting-Started) — license and login  
- [Building and Release](Building-and-Release) — how releases are built  
