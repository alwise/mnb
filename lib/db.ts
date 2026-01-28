import Database from "@tauri-apps/plugin-sql";
import { isTauri } from "./utils";

let db: Database | null = null;
const DB_NAME = "lba_receipts.db";

/**
 * Ensure database connection is in a clean state (no active transactions)
 */
async function ensureCleanState(db: Database): Promise<void> {
  try {
    // Try to rollback any lingering transaction
    await db.execute("ROLLBACK");
  } catch (e) {
    // Ignore - no transaction to rollback, which is fine
  }
}

export async function getDatabase(): Promise<Database> {
  if (db) {
    // Do NOT run ensureCleanState(ROLLBACK) here - it would abort any
    // in-progress transaction from another caller (e.g. updateReceipt),
    // causing "database is locked" or failed updates.
    return db;
  }

  // Check if we're in Tauri environment first
  if (!isTauri()) {
    throw new Error(
      'Database is only available in Tauri environment. Please run the app using "pnpm tauri dev" or build the desktop app.',
    );
  }

  // Try to load the database
  try {
    db = await Database.load(`sqlite:${DB_NAME}`);
    await initializeDatabase(db);
    // Ensure clean state after initialization
    await ensureCleanState(db);
    return db;
  } catch (error) {
    // Reset db reference on error so we can retry
    db = null;
    console.error("Database load error:", error);
    throw error;
  }
}

/**
 * Delete the database file and reset the connection
 * This will completely reset the database - use with caution!
 */
export async function deleteDatabase(): Promise<void> {
  if (!isTauri()) {
    throw new Error("Database deletion is only available in Tauri environment");
  }

  try {
    // Reset the database connection reference
    // Note: Tauri SQL plugin manages connections internally,
    // so we just reset our reference
    db = null;

    // Delete the database file using Tauri fs plugin
    const { remove, BaseDirectory } = await import("@tauri-apps/plugin-fs");

    try {
      await remove(DB_NAME, { baseDir: BaseDirectory.AppData });
      console.log("Database file deleted successfully");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      // If file doesn't exist, that's okay - it means it's already deleted
      if (
        !errorMessage.includes("not found") &&
        !errorMessage.includes("No such file")
      ) {
        throw error;
      }
      console.log("Database file already deleted or does not exist");
    }
  } catch (error) {
    console.error("Error deleting database:", error);
    throw error;
  }
}

async function migrateDatabase(db: Database): Promise<void> {
  // Try to add previous_balance column if it doesn't exist
  // SQLite will throw an error if the column already exists, which we'll ignore
  try {
    await db.execute(`
      ALTER TABLE receipts ADD COLUMN previous_balance REAL NOT NULL DEFAULT 0
    `);
    console.log("Added previous_balance column to receipts table");
  } catch (error) {
    // Column already exists or table doesn't exist yet - that's fine
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes("duplicate column") ||
      errorMessage.includes("no such table")
    ) {
      // Expected - column already exists or table will be created
      console.log(
        "previous_balance column already exists or table will be created",
      );
    }
  }

  // Add lba_name column if it doesn't exist
  try {
    await db.execute(`
      ALTER TABLE receipts ADD COLUMN lba_name TEXT
    `);
    console.log("Added lba_name column to receipts table");

    // Backfill lba_name from lba_units
    await db.execute(`
      UPDATE receipts 
      SET lba_name = (SELECT unit_name FROM lba_units WHERE lba_units.id = receipts.lba_unit_id)
      WHERE lba_name IS NULL
    `);
    console.log("Backfilled lba_name from lba_units");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes("duplicate column")) {
      console.warn("Migration warning for lba_name:", errorMessage);
    }
  }

  // Rename unit_name to unit in lba_units and add lba_name if they don't exist
  try {
    // Check if unit exists
    const tableInfo = await db.select<any[]>("PRAGMA table_info(lba_units)");
    const hasUnit = tableInfo.some((col) => col.name === "unit");
    const hasLbaName = tableInfo.some((col) => col.name === "lba_name");

    if (!hasUnit && tableInfo.some((col) => col.name === "unit_name")) {
      await db.execute(`ALTER TABLE lba_units RENAME COLUMN unit_name TO unit`);
      console.log("Renamed unit_name to unit in lba_units table");
    }

    if (!hasLbaName) {
      await db.execute(`ALTER TABLE lba_units ADD COLUMN lba_name TEXT`);
      console.log("Added lba_name column to lba_units table");

      // Attempt to backfill lba_name if possible (though for units it's usually new)
      // For now we'll just leave it NULL or set it to same as unit if appropriate
      // But actually, unit is "Unit" and lba_name is "LBA Name".
      await db.execute(
        `UPDATE lba_units SET lba_name = unit WHERE lba_name IS NULL`,
      );
    }
  } catch (error) {
    console.warn("Migration warning for lba_units renaming:", error);
  }

  // Create receipt_history table if it doesn't exist
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS receipt_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        receipt_id INTEGER NOT NULL,
        snapshot_data TEXT NOT NULL,
        change_summary TEXT,
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
      )
    `);
    console.log("Created receipt_history table");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes("already exists")) {
      console.warn("Migration warning for receipt_history:", errorMessage);
    }
  }

  // Create index for receipt_history
  try {
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_receipt_history_receipt_id ON receipt_history(receipt_id)
    `);
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_receipt_history_updated_at ON receipt_history(updated_at DESC)
    `);
  } catch (error) {
    // Index might already exist, that's fine
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes("already exists")) {
      console.warn(
        "Migration warning for receipt_history indexes:",
        errorMessage,
      );
    }
  }

  // Add new columns to company_settings if they don't exist
  const companyColumns = [
    { name: "address", type: "TEXT" },
    { name: "phone", type: "TEXT" },
    { name: "email", type: "TEXT" },
    { name: "website", type: "TEXT" },
  ];

  for (const col of companyColumns) {
    try {
      await db.execute(
        `ALTER TABLE company_settings ADD COLUMN ${col.name} ${col.type}`,
      );
      console.log(`Added ${col.name} column to company_settings table`);
    } catch (error) {
      // Column likely already exists
    }
  }
}

async function initializeDatabase(db: Database): Promise<void> {
  // Create lba_units table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS lba_units (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      unit TEXT NOT NULL,
      lba_name TEXT NOT NULL,
      crop TEXT NOT NULL,
      season TEXT NOT NULL,
      unit_head TEXT NOT NULL,
      qci_name TEXT NOT NULL,
      lba_code TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Create receipts table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS receipts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lba_unit_id INTEGER NOT NULL,
      lba_name TEXT,
      date TEXT NOT NULL,
      whr_number TEXT NOT NULL,
      description TEXT NOT NULL,
      credit_amount REAL NOT NULL DEFAULT 0,
      debit_amount REAL NOT NULL DEFAULT 0,
      weight REAL NOT NULL DEFAULT 0,
      balance_ghc REAL NOT NULL DEFAULT 0,
      previous_balance REAL NOT NULL DEFAULT 0,
      mts REAL NOT NULL DEFAULT 0,
      bags INTEGER NOT NULL DEFAULT 0,
      signature TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (lba_unit_id) REFERENCES lba_units(id) ON DELETE CASCADE
    )
  `);

  // Run migrations for existing databases
  await migrateDatabase(db);

  // Create receipt_items table for multiple rows per receipt
  await db.execute(`
    CREATE TABLE IF NOT EXISTS receipt_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      credit_amount REAL NOT NULL DEFAULT 0,
      debit_amount REAL NOT NULL DEFAULT 0,
      weight REAL NOT NULL DEFAULT 0,
      mts REAL NOT NULL DEFAULT 0,
      bags INTEGER NOT NULL DEFAULT 0,
      item_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
    )
  `);

  // Create receipt_totals table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS receipt_totals (
      lba_unit_id INTEGER PRIMARY KEY,
      cumulative_credit REAL NOT NULL DEFAULT 0,
      cumulative_debit REAL NOT NULL DEFAULT 0,
      cumulative_mts REAL NOT NULL DEFAULT 0,
      cumulative_bags INTEGER NOT NULL DEFAULT 0,
      last_updated TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (lba_unit_id) REFERENCES lba_units(id) ON DELETE CASCADE
    )
  `);

  // Create app_settings table for storing default data
  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT NOT NULL UNIQUE,
      setting_value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Create users table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      profile_photo_path TEXT,
      signature_path TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Create company_settings table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS company_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL DEFAULT 'MAN NO BE GOD COMPANY LIMITED',
      company_logo_path TEXT,
      receipt_header_text TEXT,
      address TEXT,
      phone TEXT,
      email TEXT,
      website TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Create password_reset_tokens table
  await db.execute(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create index for password_reset_tokens
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token)
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id)
  `);

  // Initialize company_settings with default values if empty
  const existingSettings = await db.select<{ count: number }[]>(
    "SELECT COUNT(*) as count FROM company_settings",
  );
  if (existingSettings[0]?.count === 0) {
    await db.execute(`
      INSERT INTO company_settings (company_name, receipt_header_text)
      VALUES ('MAN NO BE GOD COMPANY LIMITED', 'MAN NO BE GOD COMPANY LIMITED')
    `);
  }

  // Run migrations for existing databases
  await migrateDatabase(db);

  // Create indexes for better query performance
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_receipts_lba_unit_id ON receipts(lba_unit_id)
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(date)
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id ON receipt_items(receipt_id)
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_receipt_items_order ON receipt_items(receipt_id, item_order)
  `);

  // receipt_history table is created in migrateDatabase to support existing databases
}
