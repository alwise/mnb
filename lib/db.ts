import Database from "@tauri-apps/plugin-sql";
import { isTauri } from "./utils";

const DEFAULT_DB_NAME = "lba_registry.db";
const USER_DB_PREFIX = "lba_user_";
const LEGACY_DB_NAME = "lba_receipts.db";

let defaultDb: Database | null = null;
let userDb: Database | null = null;
let currentUserId: number | null = null;

/**
 * Get the current logged-in user ID from localStorage (client-side only)
 */
function getCurrentUserId(): number | null {
  if (typeof window === "undefined") return null;
  const id = localStorage.getItem("current_user_id");
  return id ? parseInt(id, 10) : null;
}

/**
 * Ensure database connection is in a clean state (no active transactions)
 */
async function ensureCleanState(db: Database): Promise<void> {
  try {
    await db.execute("ROLLBACK");
  } catch {
    // Ignore - no transaction to rollback
  }
}

/**
 * Get the path for a user's database file
 */
export function getUserDatabasePath(userId: number): string {
  return `${USER_DB_PREFIX}${userId}.db`;
}

/**
 * Get the default registry database (manages users and database mappings).
 * Use this for: auth, user management, user-to-database lookups.
 */
export async function getDefaultDatabase(): Promise<Database> {
  if (defaultDb) {
    return defaultDb;
  }

  if (!isTauri()) {
    throw new Error(
      'Database is only available in Tauri environment. Please run the app using "pnpm tauri dev" or build the desktop app.',
    );
  }

  try {
    // Migrate from legacy single-DB setup if needed
    const { exists, readFile, writeFile, remove, BaseDirectory } =
      await import("@tauri-apps/plugin-fs");
    const registryExists = await exists(DEFAULT_DB_NAME, {
      baseDir: BaseDirectory.AppData,
    });
    const legacyExists = await exists(LEGACY_DB_NAME, {
      baseDir: BaseDirectory.AppData,
    });

    if (!registryExists && legacyExists) {
      await migrateFromLegacyDatabase();
    }

    defaultDb = await Database.load(`sqlite:${DEFAULT_DB_NAME}`);
    await initializeDefaultDatabase(defaultDb);
    await ensureCleanState(defaultDb);
    return defaultDb;
  } catch (error) {
    defaultDb = null;
    console.error("Default database load error:", error);
    throw error;
  }
}

/**
 * Migrate from legacy single-DB (lba_receipts.db) to multi-DB architecture.
 * Assigns all existing data to the first user.
 */
async function migrateFromLegacyDatabase(): Promise<void> {
  const { readFile, writeFile, remove, BaseDirectory } =
    await import("@tauri-apps/plugin-fs");

  // Create registry first (load creates the file)
  const registry = await Database.load(`sqlite:${DEFAULT_DB_NAME}`);
  await initializeDefaultDatabase(registry);

  // Open legacy DB and copy users + tokens
  const legacy = await Database.load(`sqlite:${LEGACY_DB_NAME}`);
  const users = await legacy.select<
    {
      id: number;
      email: string;
      password_hash: string;
      full_name: string;
      profile_photo_path: string | null;
      signature_path: string | null;
      is_active: number;
      created_at: string;
      updated_at: string;
    }[]
  >("SELECT * FROM users");

  for (const u of users) {
    await registry.execute(
      `INSERT INTO users (id, email, password_hash, full_name, profile_photo_path, signature_path, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        u.id,
        u.email,
        u.password_hash,
        u.full_name,
        u.profile_photo_path,
        u.signature_path,
        u.is_active,
        u.created_at,
        u.updated_at,
      ],
    );
  }

  try {
    const tokens = await legacy.select<
      { user_id: number; token: string; expires_at: string; used: number }[]
    >("SELECT user_id, token, expires_at, used FROM password_reset_tokens");
    for (const t of tokens) {
      await registry.execute(
        `INSERT INTO password_reset_tokens (user_id, token, expires_at, used) VALUES ($1, $2, $3, $4)`,
        [t.user_id, t.token, t.expires_at, t.used],
      );
    }
  } catch {
    // Table might not exist
  }

  if (users.length === 0) {
    // No users - just remove legacy and we're done
    try {
      await remove(LEGACY_DB_NAME, { baseDir: BaseDirectory.AppData });
    } catch {
      // Ignore
    }
    return;
  }

  // Copy legacy DB to first user's workspace (assign all data to user 1)
  const firstUserId = users[0].id;
  const user1Path = getUserDatabasePath(firstUserId);
  const legacyData = await readFile(LEGACY_DB_NAME, {
    baseDir: BaseDirectory.AppData,
  });
  await writeFile(user1Path, legacyData, { baseDir: BaseDirectory.AppData });

  // Register first user's DB
  await registry.execute(
    `INSERT OR REPLACE INTO user_databases (user_id, database_path) VALUES ($1, $2)`,
    [firstUserId, user1Path],
  );

  // Create empty DBs for other users
  for (const u of users) {
    if (u.id !== firstUserId) {
      await createUserDatabase(u.id);
    }
  }

  // Remove legacy file
  try {
    await remove(LEGACY_DB_NAME, { baseDir: BaseDirectory.AppData });
  } catch (e) {
    console.warn("Could not remove legacy database file:", e);
  }
}

/**
 * Initialize the default registry database (users, user_databases, password_reset_tokens)
 */
async function initializeDefaultDatabase(db: Database): Promise<void> {
  // Users table - stores auth and profile info
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

  // User database mappings - links each user to their workspace database
  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_databases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      database_path TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Password reset tokens
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

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token)
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id)
  `);
}

/**
 * Create and initialize a new database for a user (called on signup)
 */
export async function createUserDatabase(userId: number): Promise<void> {
  if (!isTauri()) {
    throw new Error("Database creation is only available in Tauri environment");
  }

  const dbPath = getUserDatabasePath(userId);
  const db = await Database.load(`sqlite:${dbPath}`);
  await initializeUserDatabase(db);

  // Register in default database
  const defaultDb = await getDefaultDatabase();
  await defaultDb.execute(
    `INSERT OR REPLACE INTO user_databases (user_id, database_path) VALUES ($1, $2)`,
    [userId, dbPath],
  );
}

/**
 * Get the current user's workspace database.
 * Requires a logged-in user (current_user_id in localStorage).
 * Use this for: receipts, settings, company settings, LBA units, etc.
 */
export async function getDatabase(): Promise<Database> {
  const userId = getCurrentUserId();
  if (!userId) {
    throw new Error(
      "No user logged in. User workspace database requires an active session.",
    );
  }

  // Return cached connection if it's for the same user
  if (userDb && currentUserId === userId) {
    return userDb;
  }

  if (!isTauri()) {
    throw new Error(
      'Database is only available in Tauri environment. Please run the app using "pnpm tauri dev" or build the desktop app.',
    );
  }

  // Close previous user DB if switching users
  if (userDb) {
    userDb = null;
    currentUserId = null;
  }

  try {
    const dbPath = getUserDatabasePath(userId);
    try {
      userDb = await Database.load(`sqlite:${dbPath}`);
    } catch (loadError) {
      // Database file may not exist (e.g. manually deleted) - recreate it
      const msg =
        loadError instanceof Error ? loadError.message : String(loadError);
      if (
        msg.includes("not found") ||
        msg.includes("No such file") ||
        msg.includes("unable to open")
      ) {
        await createUserDatabase(userId);
        userDb = await Database.load(`sqlite:${dbPath}`);
      } else {
        throw loadError;
      }
    }
    currentUserId = userId;

    // Ensure schema exists (handles first login after signup)
    await initializeUserDatabase(userDb);
    await ensureCleanState(userDb);
    return userDb;
  } catch (error) {
    userDb = null;
    currentUserId = null;
    console.error("User database load error:", error);
    throw error;
  }
}

/**
 * Clear the user database connection (call on logout).
 * Next login will open the new user's database.
 */
export function clearUserDatabase(): void {
  userDb = null;
  currentUserId = null;
}

/**
 * Get the path of the current user's database file (for backup/restore).
 * Returns null if no user is logged in.
 */
export function getCurrentUserDatabasePath(): string | null {
  const userId = getCurrentUserId();
  return userId ? getUserDatabasePath(userId) : null;
}

/**
 * Initialize a user's workspace database (schema only - no users table)
 */
async function initializeUserDatabase(db: Database): Promise<void> {
  // LBA units
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

  // Receipts
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

  await migrateUserDatabase(db);

  // Receipt items
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
      signature TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE CASCADE
    )
  `);

  // Receipt totals
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

  // App settings
  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      setting_key TEXT NOT NULL UNIQUE,
      setting_value TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Company settings
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

  await migrateUserDatabase(db);

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

  // Indexes
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
}

async function migrateUserDatabase(db: Database): Promise<void> {
  // previous_balance
  try {
    await db.execute(`
      ALTER TABLE receipts ADD COLUMN previous_balance REAL NOT NULL DEFAULT 0
    `);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("duplicate column") && !msg.includes("no such table")) {
      console.warn("Migration previous_balance:", msg);
    }
  }

  // lba_name on receipts (use unit for backfill - schema has unit not unit_name)
  try {
    await db.execute(`
      ALTER TABLE receipts ADD COLUMN lba_name TEXT
    `);
    await db.execute(`
      UPDATE receipts 
      SET lba_name = (SELECT unit FROM lba_units WHERE lba_units.id = receipts.lba_unit_id)
      WHERE lba_name IS NULL
    `);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("duplicate column")) {
      console.warn("Migration lba_name:", msg);
    }
  }

  // unit_name -> unit in lba_units
  try {
    const tableInfo = await db.select<any[]>("PRAGMA table_info(lba_units)");
    const hasUnit = tableInfo.some((col) => col.name === "unit");
    const hasLbaName = tableInfo.some((col) => col.name === "lba_name");

    if (!hasUnit && tableInfo.some((col) => col.name === "unit_name")) {
      await db.execute(`ALTER TABLE lba_units RENAME COLUMN unit_name TO unit`);
    }
    if (!hasLbaName) {
      await db.execute(`ALTER TABLE lba_units ADD COLUMN lba_name TEXT`);
      await db.execute(
        `UPDATE lba_units SET lba_name = unit WHERE lba_name IS NULL`,
      );
    }
  } catch (e) {
    console.warn("Migration lba_units:", e);
  }

  // signature on receipt_items
  try {
    await db.execute(`
      ALTER TABLE receipt_items ADD COLUMN signature TEXT
    `);
  } catch {
    // Column may already exist
  }

  // receipt_history
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
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_receipt_history_receipt_id ON receipt_history(receipt_id)
    `);
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_receipt_history_updated_at ON receipt_history(updated_at DESC)
    `);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("already exists")) {
      console.warn("Migration receipt_history:", msg);
    }
  }

  // company_settings columns
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
    } catch {
      // Column likely exists
    }
  }
}

/**
 * Delete the current user's workspace database and reset the connection.
 * Does NOT delete the user account - only their workspace data.
 */
export async function deleteDatabase(): Promise<void> {
  if (!isTauri()) {
    throw new Error("Database deletion is only available in Tauri environment");
  }

  const dbPath = getCurrentUserDatabasePath();
  if (!dbPath) {
    throw new Error("No user logged in - cannot delete workspace database");
  }

  try {
    clearUserDatabase();

    const { remove, BaseDirectory } = await import("@tauri-apps/plugin-fs");
    try {
      await remove(dbPath, { baseDir: BaseDirectory.AppData });
      console.log("User workspace database deleted successfully");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (
        !errorMessage.includes("not found") &&
        !errorMessage.includes("No such file")
      ) {
        throw error;
      }
    }
  } catch (error) {
    console.error("Error deleting database:", error);
    throw error;
  }
}
