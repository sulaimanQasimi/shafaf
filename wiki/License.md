# License

How **شفاف (Shafaf)** checks the license and how to generate keys with `license-generator.html`.

---

## Overview

- The app requires a **valid license** to use. On startup it checks:
  1. A stored license key (in the system keyring: `finance_app` / `license_key`).
  2. If none or invalid: show the **License** screen.
- The key is **tied to the machine**: it is produced by encrypting the **Machine ID** of the device. A key from one machine will not validate on another.

---

## Flow

1. **User** opens the app. If no valid key is stored, the **License** screen is shown with a **Machine ID**.
2. **User** sends that Machine ID to the **license provider** (you or your backend).
3. **Provider** runs `license-generator.html` (or equivalent) with that Machine ID and obtains a **license key**.
4. **Provider** sends the key to the user.
5. **User** enters the key in the app and submits. The app calls `validate_license_key`; if it matches the encryption of the **current** Machine ID, the key is valid.
6. On success, the app **stores** the key via `store_license_key` (keyring) and proceeds to **Login**.

---

## Validation (Rust)

- **`get_machine_id`**: returns the Machine ID (from CPU, hostname, system name, kernel, total memory, CPU count, hashed).
- **`validate_license_key(entered_key)`**:  
  - Computes the current Machine ID.  
  - Encrypts it with the same algorithm and secrets as the generator.  
  - Compares (case-insensitive) the result with `entered_key`.  
  - Returns `true` only if they match.
- **`store_license_key`** / **`get_license_key`**: read/write the key in the system keyring.

The logic lives in `src-tauri/src/license.rs`; Tauri commands are in `src-tauri/src/lib.rs`.

---

## License Generator (`license-generator.html`)

- **Location**: `license-generator.html` in the project root.
- **Purpose**: encrypt the **Machine ID** so it can be used as the license key. The **Rust** side never decrypts; it encrypts the current Machine ID and checks equality.

### Algorithm (must match Rust)

- **Key**: SHA-256 of `SECRET_KEY_BASE + SALT` (32 bytes).
- **Nonce**: first 12 bytes of SHA-256 of `machineId + SALT`.
- **Cipher**: AES-256-GCM.
- **Output**: `nonce || ciphertext` encoded as hex.

Constants in both Rust and the HTML:

- `SECRET_KEY_BASE = "com.sulaiman.financeapp.license.secret.2024"`
- `SALT = "finance-app-salt-2024"`

If you change these in `license.rs`, you must change them in `license-generator.html` (and any other generator) too.

### How to Use

1. User sends you the **Machine ID** from the app.
2. Open `license-generator.html` in a browser (needs `crypto.subtle`; avoid `file://` if you hit CORS/crypto issues; use a simple HTTP server if needed).
3. Paste the Machine ID, click **Generate License Key**.
4. Copy the hex key and send it to the user.
5. User pastes it into the app and submits.

---

## Frontend

- **`src/utils/license.ts`**:  
  - `getMachineId`, `storeLicenseKey`, `getLicenseKey`, `validateLicenseKey`, `isLicenseValid`.  
  - `isLicenseValid` reads the stored key and calls `validateLicenseKey`; used at startup to decide License vs Login.
- **`src/components/License.tsx`**: License UI (show Machine ID, input for key, submit, then `storeLicenseKey` and `validateLicenseKey`).

---

## Security Notes

- The **secret** and **salt** are in the app and in the HTML. This prevents casual sharing but is not secure against a determined reverse engineer. For higher security you’d move key generation to a server and add extra checks (expiry, features, etc.).
- **`license-generator.html`** should only be used by the license provider; do not ship it to end users in the app. It is in the repo for your internal/support use.

---

## Related

- [Getting Started](Getting-Started) — when the License screen appears  
- [Troubleshooting](Troubleshooting) — license and generator issues  
