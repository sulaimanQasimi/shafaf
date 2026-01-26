# Tauri Auto-Updater Setup Guide

This guide explains how to complete the auto-updater setup after the initial configuration.

## Prerequisites

The auto-updater plugin has been configured in the codebase. You need to complete the following steps to enable automatic updates.

## Step 1: Generate Signing Keys

The updater requires cryptographic signing keys for security. Generate them using:

```bash
npm run tauri signer generate
```

This will:
- Create a public key (add this to `src-tauri/tauri.conf.json` in the `updater.pubkey` field)
- Create a private key (store this securely as a GitHub secret)

**Important:** Keep the private key secure! If you lose it, you cannot publish updates to already-installed apps.

## Step 2: Update tauri.conf.json

After generating keys, update `src-tauri/tauri.conf.json`:

1. Replace the placeholder `pubkey` value in the `updater` section with your actual public key
2. The public key will be displayed after running `npm run tauri signer generate`

Example:
```json
"updater": {
  "active": true,
  "endpoints": [
    "https://github.com/sulaimanQasimi/shafaf/releases/latest/download/latest.json"
  ],
  "dialog": true,
  "pubkey": "YOUR_ACTUAL_PUBLIC_KEY_HERE"
}
```

## Step 3: Configure GitHub Secret

1. Go to your GitHub repository: https://github.com/sulaimanQasimi/shafaf
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `TAURI_SIGNING_PRIVATE_KEY`
5. Value: Paste your private key (from step 1)
6. Click **Add secret**

## Step 4: Test the Setup

1. Create a test release by pushing a version tag:
   ```bash
   git tag v6.3.3
   git push origin v6.3.3
   ```

2. The GitHub Actions workflow will:
   - Build the Windows installer
   - Sign it with your private key
   - Generate `latest.json` manifest
   - Upload everything to the GitHub release

3. Verify that `latest.json` appears in the release assets

## How It Works

1. **Developer workflow:**
   - Update version in `package.json`, `Cargo.toml`, and `tauri.conf.json`
   - Commit and push a version tag (e.g., `v6.3.3`)
   - GitHub Actions builds, signs, and releases

2. **User experience:**
   - App checks for updates on startup (or manually)
   - If update available, shows dialog
   - User can download and install update
   - App restarts with new version

## Using Update Functions in Frontend

The update utility functions are available in `src/utils/updater.ts`:

```typescript
import { checkForUpdates, installUpdate } from "./utils/updater";

// Check for updates
const updateInfo = await checkForUpdates();
if (updateInfo?.available) {
  // Show notification or dialog
  console.log("Update available:", updateInfo.version);
}

// Install update (downloads, installs, and restarts)
await installUpdate();
```

## Troubleshooting

### Updates not detected
- Verify `latest.json` is in the release assets
- Check that the `pubkey` in `tauri.conf.json` matches your public key
- Ensure the version in `latest.json` is newer than the installed version

### Signing errors
- Verify `TAURI_SIGNING_PRIVATE_KEY` secret is set correctly
- Ensure the private key matches the public key in `tauri.conf.json`

### Workflow fails
- Check GitHub Actions logs for specific errors
- Verify all secrets are configured correctly
- Ensure the installer file is found after build

## Notes

- The updater only works on Windows, Linux, and macOS (desktop platforms)
- Android/iOS have limited support
- Updates are checked against the `latest.json` file in GitHub releases
- The update endpoint URL is configured in `tauri.conf.json`
