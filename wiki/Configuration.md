# Configuration

How to configure **شفاف (Shafaf)** via environment variables and in-app settings.

---

## Environment Variables

Create a `.env` file in the **project root** (copy from `.env.example`). It is not committed. See [ENV_CONFIG.md](../ENV_CONFIG.md) for details.

### Database

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_PATH` | Path to the SQLite database file | `E:/db.sqlite`, `./data/db.sqlite` |

- **Windows**: use forward slashes or escaped backslashes, e.g. `E:/db.sqlite` or `E:\\db.sqlite`.
- **Linux/macOS**: e.g. `./data/db.sqlite` or `/var/lib/app/db.sqlite`.
- **Default**: often `E:\\db.sqlite` (Windows) or `./data/db.sqlite` (Linux/macOS) in the app; check `src-tauri` for actual defaults.
- **Android**: uses app-private storage; `ANDROID_DATABASE_PATH` or similar may apply in some setups.

### Application (optional)

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_NAME` | Application name | `"Tauri App"` |
| `APP_VERSION` | Application version | `"0.1.0"` |
| `LOG_LEVEL` | Log level: DEBUG, INFO, WARN, ERROR | `"INFO"` |
| `DEV_MODE` | Development mode | `"true"` |

The Rust backend loads `.env` with the `dotenv` crate.

---

## In-App: Company Settings

- **Company name**, address, logo, tax ID, etc.
- Used in **invoices** and reports.
- Reachable from the main menu: **Company Settings**.

---

## In-App: User and Permissions

- **Users**: managed in the Users section (admin).
- **Profile**: change password and profile data for the current user.

---

## Tauri and Build

- **`src-tauri/tauri.conf.json`**:  
  - `productName`, `version`, `identifier` (`com.sulaiman.shafaf`)  
  - `bundle.android` (minSdkVersion, versionCode)  
  - `bundle.windows` (certificate, etc.)
- **`package.json`**: `version` should match `tauri.conf.json` and `Cargo.toml` when releasing.

---

## Related

- [ENV_CONFIG.md](../ENV_CONFIG.md)  
- [Features](Features) — Company Settings  
- [Android Setup](Android-Setup) — env and paths on Android  
