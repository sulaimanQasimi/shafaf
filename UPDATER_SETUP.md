# Tauri Auto-Updater Setup Guide

This guide explains how to complete the auto-updater setup after the initial configuration.

## Prerequisites

The auto-updater plugin has been configured in the codebase. The signing keys have been generated and the public key has been added to `tauri.conf.json`.

## Step 1: Configure GitHub Secret

Your private key is stored in `TAURI_SIGNING_PRIVATE_KEY.txt` (this file is gitignored and should NOT be committed).

To enable automatic signing in GitHub Actions:

1. Go to your GitHub repository: https://github.com/sulaimanQasimi/shafaf
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `TAURI_SIGNING_PRIVATE_KEY`
5. Value: Copy the entire key from `TAURI_SIGNING_PRIVATE_KEY.txt` (the base64 encoded string)
6. Click **Add secret**

**Note:** If you set a password when generating the key, also add:
- Name: `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- Value: Your password

## Step 2: Test the Setup

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

## Key Files

- **Public Key**: Already configured in `src-tauri/tauri.conf.json` under `updater.pubkey`
- **Private Key**: Stored in `TAURI_SIGNING_PRIVATE_KEY.txt` (gitignored, do not commit!)

## Troubleshooting

### Updates not detected
- Verify `latest.json` is in the release assets
- Check that the `pubkey` in `tauri.conf.json` is correct (already configured)
- Ensure the version in `latest.json` is newer than the installed version

### Signing errors
- Verify `TAURI_SIGNING_PRIVATE_KEY` secret is set correctly in GitHub
- Ensure the private key in GitHub secret matches the one in `TAURI_SIGNING_PRIVATE_KEY.txt`
- If you set a password, ensure `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` secret is also configured

### Workflow fails
- Check GitHub Actions logs for specific errors
- Verify all secrets are configured correctly
- Ensure the installer file is found after build

## Notes

- The updater only works on Windows, Linux, and macOS (desktop platforms)
- Android/iOS have limited support
- Updates are checked against the `latest.json` file in GitHub releases
- The update endpoint URL is configured in `tauri.conf.json`
