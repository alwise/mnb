# MAN NO BE GOD COMPANY LIMITED

A Windows-first offline desktop application for managing stock/receipt records derived from the paper document "LBA STOCK SHEET".

**MAN NO BE GOD COMPANY LIMITED** (MNB)

## Features

- ✅ 100% offline operation using SQLite
- ✅ Create, view, edit, list, and print receipts
- ✅ Maintain cumulative totals (credit, debit, weight, bags, MTS)
- ✅ Filter receipts by date, LBA unit, and crop
- ✅ Printable receipt layout matching the paper stock sheet format
- ✅ Dashboard with summary statistics

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Desktop Framework**: Tauri v2
- **Database**: SQLite via @tauri-apps/plugin-sql
- **Build**: Static export (no server-side code)

## Prerequisites

- Node.js 18+ and pnpm
- Rust (for Tauri) - **Required for development**
- Windows SDK (for Windows builds - only needed when building Windows installers)

## Installation

1. **Install Rust** (if not already installed):

   ```bash
   # On macOS/Linux:
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

   # After installation, restart your terminal or run:
   source ~/.cargo/env

   # Verify installation:
   cargo --version
   rustc --version
   ```

2. **Install Node.js dependencies**:

   ```bash
   pnpm install
   ```

3. **Verify Tauri setup**:
   ```bash
   # This will download Rust dependencies on first run
   pnpm tauri dev
   ```

## Development

1. Start the Next.js development server:

```bash
pnpm dev
```

2. In another terminal, start Tauri in development mode:

```bash
pnpm tauri dev
```

This will:

- Build the Next.js app
- Launch the Tauri desktop window
- Enable hot-reload for both frontend and backend

## Building for Production

1. Build the Next.js static export:

```bash
pnpm build
```

2. Build the Tauri desktop app:

```bash
pnpm tauri build
```

The Windows installer (.msi or .exe) will be generated in `src-tauri/target/release/bundle/`.

## Project Structure

```
├── app/                    # Next.js App Router pages
│   ├── dashboard/         # Dashboard page
│   └── receipts/          # Receipt management pages
├── components/            # Reusable React components
├── lib/                   # Business logic and database utilities
│   ├── db.ts             # SQLite database initialization
│   └── receipts.ts       # Receipt CRUD operations
├── types/                 # TypeScript type definitions
└── src-tauri/            # Tauri Rust backend
    ├── src/
    ├── Cargo.toml
    └── tauri.conf.json
```

## Database Schema

### lba_units

Stores LBA unit information (unit name, crop, season, etc.)

### receipts

Stores individual receipt records with all transaction details

### receipt_totals

Maintains cumulative totals per LBA unit (credit, debit, MTS, bags)

## Usage

1. **Create LBA Unit**: Navigate to "Create Receipt" and click "+ New LBA Unit"
2. **Create Receipt**: Fill in the receipt form with all required fields
3. **View Receipts**: Browse the receipts list with filtering options
4. **View Details**: Click on any receipt to view full details
5. **Print/Export**: Use the "Print / Export PDF" button to generate a printable receipt

## Notes

- The app requires Tauri environment to run (database operations won't work in browser-only mode)
- All data is stored locally in SQLite database (`lba_receipts.db`)
- The app is configured for Windows-first deployment but can be built for other platforms

### macOS

If you see a warning about the app being damaged or from an unidentified developer, you can clear the extended attributes with:

```bash
sudo xattr -cr /Applications/"MAN NO BE GOD COMPANY LIMITED.app"
```

## License

Private - All rights reserved
