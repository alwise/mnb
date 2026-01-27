---
description: Build Tauri application for macOS and preparation for Windows
---

# Tauri Build Workflow

This workflow describes how to build the application for macOS (DMG) and prepare for Windows (MSI/EXE) builds.

## Prerequisites
- Rust and Cargo installed
- Node.js and pnpm installed
- macOS for DMG builds
- Windows for MSI/EXE builds (or GitHub Actions)

## 1. Prepare Frontend
The project has been refactored to use static-safe routing (search parameters instead of dynamic path segments) to support `output: 'export'`. Ensure that `next.config.js` is set to `output: 'export'`.
// turbo
```bash
pnpm install
```

## 2. Build for macOS (DMG)
This will generate a `.dmg` file in `src-tauri/target/release/bundle/dmg/`.
// turbo
```bash
pnpm tauri build --bundles dmg
```

## 3. Build for Windows (MSI, EXE)
*Note: This usually requires a Windows environment.*
If you are on Windows, run:
```powershell
pnpm tauri build --bundles msi,nsis
```

## 4. Automation (GitHub Actions)
For automated multi-platform builds, use the Tauri Action. A sample workflow file can be found in `.github/workflows/release.yml`.
