# GitHub Auto-Release Guide

This guide explains how to use the automated release workflow for Windows and Android builds.

## How It Works

The workflow automatically builds and releases your Tauri app when you push a version tag to GitHub.

## Creating a Release

1. **Update the version** in both `package.json` and `src-tauri/Cargo.toml`:
   ```json
   "version": "6.3.3"
   ```

2. **Commit your changes**:
   ```bash
   git add .
   git commit -m "Bump version to 6.3.3"
   ```

3. **Create and push a version tag**:
   ```bash
   git tag v6.3.3
   git push origin v6.3.3
   ```

   Or push all tags:
   ```bash
   git push --tags
   ```

4. **The workflow will automatically**:
   - Build the Windows installer (NSIS)
   - Build the Android APK and AAB
   - Create a GitHub release with all artifacts attached

## What Gets Built

### Windows
- NSIS installer (`.exe` file)
- Located in: `src-tauri/target/release/bundle/nsis/`

### Android
- APK file (for direct installation)
- AAB file (for Google Play Store)
- Located in: `src-tauri/target/android/apk/release/` and `src-tauri/target/android/aab/release/`

## Workflow Details

The workflow runs two jobs in parallel:

1. **build-windows**: Builds on Windows runner, creates NSIS installer
2. **build-android**: Builds on Ubuntu runner, creates APK/AAB files

Both jobs upload their artifacts to the same GitHub release.

## Requirements

- The workflow uses `GITHUB_TOKEN` automatically (no setup needed)
- For Android builds, the Android project must be initialized (handled automatically)
- Version tags must follow the format `v*` (e.g., `v6.3.3`)

## Troubleshooting

### Build fails
- Check the Actions tab in GitHub for error logs
- Ensure all dependencies are properly configured
- Verify version numbers match in `package.json` and `Cargo.toml`

### Android build fails
- The workflow automatically initializes the Android project if needed
- Ensure `ANDROID_SETUP.md` requirements are met (for local testing)

### Release not created
- Verify the tag format matches `v*`
- Check that the tag was pushed to the remote repository
- Review workflow logs in the Actions tab
