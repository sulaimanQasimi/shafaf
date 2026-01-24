# Development

How to set up and run **شفاف (Shafaf)** for local development.

---

## Prerequisites

- **Node.js** 18+ (20 recommended) — [nodejs.org](https://nodejs.org/)
- **Rust** (stable) — [rustup.rs](https://rustup.rs/)  
  ```bash
  rustup default stable
  ```
- **npm** (comes with Node)

Optional for Android:

- **JDK 17+**, **Android SDK**, **Android NDK**, **cargo-ndk**, Rust Android targets  
  See [Android Setup](Android-Setup).

---

## Initial Setup

1. **Clone** the repository and open the project folder.

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **(Optional)** Copy `.env.example` to `.env` and set `DATABASE_PATH` and other variables. See [Configuration](Configuration) and [ENV_CONFIG.md](../ENV_CONFIG.md).

---

## Run in Development

```bash
npm run tauri dev
```

This will:

- Start the Vite dev server (frontend)
- Build and run the Tauri app (Rust + WebView)
- Open the app window with hot-reload for the frontend

---

## Project Layout

| Path | Description |
|------|-------------|
| `src/` | React frontend (components, utils, `App.tsx`, `main.tsx`) |
| `src-tauri/` | Tauri/Rust backend (`src/lib.rs`, `src/db/`, `src/license.rs`, etc.) |
| `src-tauri/tauri.conf.json` | Tauri config (identifier, version, bundle, android) |
| `src-tauri/gen/android/` | Generated Android project (after `tauri android init`) |
| `package.json` | Node deps and scripts (`dev`, `build`, `tauri`) |
| `vite.config.ts` | Vite config |
| `tailwind.config.js` | Tailwind config |
| `.env` | Local env (not committed); see `.env.example` |

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Vite dev server only (no Tauri) |
| `npm run build` | `tsc && vite build` — frontend production build |
| `npm run tauri dev` | Full app in development mode |
| `npm run tauri build` | Production build (desktop) |
| `npm run tauri android dev` | Run on Android device/emulator |
| `npm run tauri android build` | Build Android APK/AAB |

---

## IDE

- **VS Code** with [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) and [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer) is recommended.

---

## Related

- [Configuration](Configuration)  
- [Building and Release](Building-and-Release)  
- [Android Setup](Android-Setup)  
