import Database from '@tauri-apps/plugin-sql';
import {
  getDatabase,
  deleteDatabase,
  getDefaultDatabase,
  getUserDatabasePath,
  getCurrentUserDatabasePath,
} from './db';
import { isTauri } from './utils';
import { logout } from './auth';

export type BackupType = 'my-data' | 'all';

export interface BackupData {
  version: string;
  timestamp: string;
  database: string; // Base64 encoded database file
  files: {
    signatures: { [key: string]: string }; // filename -> base64
    photos: { [key: string]: string }; // filename -> base64
    logos: { [key: string]: string }; // filename -> base64
    receiptPhotos: { [key: string]: string }; // filename -> base64
  };
}

/** Sanitize email for use as filename (e.g. user@example.com -> user_at_example_com) */
function sanitizeEmailForFilename(email: string): string {
  return email.replace(/@/g, '_at_').replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Convert Uint8Array to base64 in chunks to avoid "Maximum call stack size exceeded"
 * when processing large files (e.g. databases, images) on Windows and other platforms.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/** Read a file by path and return base64, or null if not found */
async function readFileAsBase64(
  readFile: (path: string, opts: { baseDir: number }) => Promise<Uint8Array>,
  path: string,
  BaseDirectory: { AppData: number },
): Promise<string | null> {
  try {
    const fileData = await readFile(path, { baseDir: BaseDirectory.AppData });
    return uint8ArrayToBase64(fileData);
  } catch {
    return null;
  }
}

/** Collect files for a specific user from their paths (registry + workspace db) */
async function collectUserFiles(
  userId: number,
  registryUser: { profile_photo_path: string | null; signature_path: string | null },
  userDb: Database,
  readFile: (path: string, opts: { baseDir: number }) => Promise<Uint8Array>,
  BaseDirectory: { AppData: number },
): Promise<BackupData['files']> {
  const signatures: { [key: string]: string } = {};
  const photos: { [key: string]: string } = {};
  const logos: { [key: string]: string } = {};
  const receiptPhotos: { [key: string]: string } = {};

  // Profile photo and signature from registry
  if (registryUser.profile_photo_path) {
    const base64 = await readFileAsBase64(readFile, registryUser.profile_photo_path, BaseDirectory);
    if (base64) {
      const name = registryUser.profile_photo_path.split('/').pop() || 'profile.png';
      photos[name] = base64;
    }
  }
  if (registryUser.signature_path) {
    const base64 = await readFileAsBase64(readFile, registryUser.signature_path, BaseDirectory);
    if (base64) {
      const name = registryUser.signature_path.split('/').pop() || 'signature.png';
      signatures[name] = base64;
    }
  }

  // Company logo from user's workspace
  const companyRows = await userDb.select<{ company_logo_path: string | null }[]>(
    'SELECT company_logo_path FROM company_settings LIMIT 1',
  );
  if (companyRows[0]?.company_logo_path) {
    const base64 = await readFileAsBase64(readFile, companyRows[0].company_logo_path, BaseDirectory);
    if (base64) {
      const name = companyRows[0].company_logo_path.split('/').pop() || 'logo.png';
      logos[name] = base64;
    }
  }

  // Receipt photos from user's app_settings
  const receiptPaths = await userDb.select<{ setting_key: string; setting_value: string }[]>(
    "SELECT setting_key, setting_value FROM app_settings WHERE setting_key LIKE 'receipt_photo_path_%'",
  );
  for (const row of receiptPaths) {
    if (row.setting_value) {
      const base64 = await readFileAsBase64(readFile, row.setting_value, BaseDirectory);
      if (base64) {
        const name = row.setting_value.split('/').pop() || `receipt_${row.setting_key}.png`;
        receiptPhotos[name] = base64;
      }
    }
  }

  return { signatures, photos, logos, receiptPhotos };
}

/**
 * Backup my data: backup only the current user's database and their files.
 */
export async function createBackupMyData(): Promise<string> {
  if (!isTauri()) {
    throw new Error('Backup is only available in Tauri environment');
  }

  const { readFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');
  const { save } = await import('@tauri-apps/plugin-dialog');

  const dbPath = getCurrentUserDatabasePath();
  if (!dbPath) {
    throw new Error('No user logged in. Please log in to create a backup.');
  }

  const userId = typeof window !== 'undefined' ? parseInt(localStorage.getItem('current_user_id') || '0', 10) : 0;
  if (!userId) {
    throw new Error('No user logged in. Please log in to create a backup.');
  }

  try {
    let dbData: Uint8Array;
    try {
      dbData = await readFile(dbPath, { baseDir: BaseDirectory.AppData });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('not found') || errorMessage.includes('No such file')) {
        throw new Error('Database file not found. Please create some data first.');
      }
      throw error;
    }

    const dbBase64 = uint8ArrayToBase64(dbData);

    const registry = await getDefaultDatabase();
    const users = await registry.select<
      { email: string; profile_photo_path: string | null; signature_path: string | null }[]
    >('SELECT email, profile_photo_path, signature_path FROM users WHERE id = $1', [userId]);
    const registryUser = users[0] ?? {
      email: 'unknown',
      profile_photo_path: null,
      signature_path: null,
    };

    const userDb = await getDatabase();
    const files = await collectUserFiles(
      userId,
      { profile_photo_path: registryUser.profile_photo_path, signature_path: registryUser.signature_path },
      userDb,
      readFile,
      BaseDirectory,
    );

    const backup: BackupData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      database: dbBase64,
      files,
    };

    const backupJson = JSON.stringify(backup, null, 2);
    const defaultPath = `${sanitizeEmailForFilename(registryUser.email)}.json`;

    const filePath = await save({
      defaultPath,
      filters: [{ name: 'Backup Files', extensions: ['json'] }],
    });

    if (!filePath) {
      throw new Error('Backup cancelled');
    }

    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    await writeTextFile(filePath, backupJson);

    return filePath;
  } catch (error) {
    console.error('Error creating backup:', error);
    throw error;
  }
}

/**
 * Backup all: backup all users' databases into a zip folder.
 * Each file is named by the account email address (e.g. user_at_example_com.json).
 */
export async function createBackupAll(): Promise<string> {
  if (!isTauri()) {
    throw new Error('Backup is only available in Tauri environment');
  }

  const { readFile, exists, BaseDirectory } = await import('@tauri-apps/plugin-fs');
  const { save } = await import('@tauri-apps/plugin-dialog');
  const JSZip = (await import('jszip')).default;

  try {
    const registry = await getDefaultDatabase();
    const users = await registry.select<
      { id: number; email: string; profile_photo_path: string | null; signature_path: string | null }[]
    >('SELECT id, email, profile_photo_path, signature_path FROM users WHERE is_active = 1');

    if (users.length === 0) {
      throw new Error('No users found to backup.');
    }

    const zip = new JSZip();

    for (const user of users) {
      const dbPath = getUserDatabasePath(user.id);
      const dbExists = await exists(dbPath, { baseDir: BaseDirectory.AppData });
      if (!dbExists) {
        console.log(`Skipping user ${user.email}: database not found`);
        continue;
      }

      const dbData = await readFile(dbPath, { baseDir: BaseDirectory.AppData });
      const dbBase64 = uint8ArrayToBase64(dbData);

      let userDb: Database;
      try {
        userDb = await Database.load(`sqlite:${dbPath}`);
      } catch {
        console.log(`Skipping user ${user.email}: could not open database`);
        continue;
      }

      const files = await collectUserFiles(
        user.id,
        { profile_photo_path: user.profile_photo_path, signature_path: user.signature_path },
        userDb,
        readFile,
        BaseDirectory,
      );

      const backup: BackupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        database: dbBase64,
        files,
      };

      const filename = `${sanitizeEmailForFilename(user.email)}.json`;
      zip.file(filename, JSON.stringify(backup, null, 2));
    }

    const zipBlob = await zip.generateAsync({ type: 'uint8array' });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const defaultPath = `mnb-backup-all-${timestamp}.zip`;

    const filePath = await save({
      defaultPath,
      filters: [{ name: 'Zip Archives', extensions: ['zip'] }],
    });

    if (!filePath) {
      throw new Error('Backup cancelled');
    }

    const { writeFile } = await import('@tauri-apps/plugin-fs');
    await writeFile(filePath, zipBlob);

    return filePath;
  } catch (error) {
    console.error('Error creating backup:', error);
    throw error;
  }
}

/**
 * Create a backup. Use createBackupMyData() or createBackupAll() for specific types.
 * This is kept for backwards compatibility - defaults to "my data".
 */
export async function createBackup(): Promise<string> {
  return createBackupMyData();
}

/**
 * Restore data from a backup file
 */
export async function restoreBackup(): Promise<void> {
  if (!isTauri()) {
    throw new Error('Restore is only available in Tauri environment');
  }

  const { open } = await import('@tauri-apps/plugin-dialog');
  const { readTextFile, writeFile, mkdir, BaseDirectory, remove } = await import('@tauri-apps/plugin-fs');

  try {
    // Open file dialog
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: 'Backup Files',
          extensions: ['json'],
        },
      ],
    });

    if (!selected || Array.isArray(selected)) {
      throw new Error('No backup file selected');
    }

    // Read backup file
    const backupJson = await readTextFile(selected);
    const backup: BackupData = JSON.parse(backupJson);

    // Validate backup structure
    if (!backup.database || !backup.files) {
      throw new Error('Invalid backup file format');
    }

    const dbPath = getCurrentUserDatabasePath();
    if (!dbPath) {
      throw new Error('No user logged in. Please log in to restore a backup.');
    }

    // Delete existing database (this will reset the connection reference)
    const { deleteDatabase } = await import('./db');
    try {
      await deleteDatabase();
    } catch (error) {
      // If database doesn't exist, that's okay - we'll create it
      console.log('Database file not found, will restore from backup');
    }

    // Restore database
    const dbData = Uint8Array.from(atob(backup.database), c => c.charCodeAt(0));
    await writeFile(dbPath, dbData, { baseDir: BaseDirectory.AppData });

    // Restore signatures
    if (backup.files.signatures && Object.keys(backup.files.signatures).length > 0) {
      const sigDir = 'signatures';
      await mkdir(sigDir, { baseDir: BaseDirectory.AppData, recursive: true });
      for (const [filename, base64] of Object.entries(backup.files.signatures)) {
        const fileData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        await writeFile(`${sigDir}/${filename}`, fileData, { baseDir: BaseDirectory.AppData });
      }
    }

    // Restore photos
    if (backup.files.photos && Object.keys(backup.files.photos).length > 0) {
      const photosDir = 'users/photos';
      await mkdir(photosDir, { baseDir: BaseDirectory.AppData, recursive: true });
      for (const [filename, base64] of Object.entries(backup.files.photos)) {
        const fileData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        await writeFile(`${photosDir}/${filename}`, fileData, { baseDir: BaseDirectory.AppData });
      }
    }

    // Restore logos
    if (backup.files.logos && Object.keys(backup.files.logos).length > 0) {
      const logosDir = 'company/logos';
      await mkdir(logosDir, { baseDir: BaseDirectory.AppData, recursive: true });
      for (const [filename, base64] of Object.entries(backup.files.logos)) {
        const fileData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        await writeFile(`${logosDir}/${filename}`, fileData, { baseDir: BaseDirectory.AppData });
      }
    }

    // Restore receipt photos
    if (backup.files.receiptPhotos && Object.keys(backup.files.receiptPhotos).length > 0) {
      const receiptPhotosDir = 'receipts/photos';
      await mkdir(receiptPhotosDir, { baseDir: BaseDirectory.AppData, recursive: true });
      for (const [filename, base64] of Object.entries(backup.files.receiptPhotos)) {
        const fileData = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
        await writeFile(`${receiptPhotosDir}/${filename}`, fileData, { baseDir: BaseDirectory.AppData });
      }
    }

    // Reinitialize database connection (this will load the restored database)
    await getDatabase();
  } catch (error) {
    console.error('Error restoring backup:', error);
    throw error;
  }
}

/**
 * Delete current user account and all their data
 */
export async function deleteAccount(userId: number): Promise<void> {
  const db = await getDefaultDatabase();

  try {
    await db.execute('BEGIN TRANSACTION');

    // Delete user's password reset tokens
    await db.execute('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);

    // Remove user database mapping
    await db.execute('DELETE FROM user_databases WHERE user_id = $1', [userId]);

    // Delete user account
    await db.execute('DELETE FROM users WHERE id = $1', [userId]);

    await db.execute('COMMIT');

    // Delete user's workspace database file
    if (isTauri()) {
      const { remove, BaseDirectory } = await import('@tauri-apps/plugin-fs');
      const userDbPath = getUserDatabasePath(userId);
      try {
        await remove(userDbPath, { baseDir: BaseDirectory.AppData });
      } catch (e) {
        console.log('User database file not found or already deleted');
      }
    }

    // Delete user's files
    if (isTauri()) {
      const { remove, readDir, BaseDirectory } = await import('@tauri-apps/plugin-fs');

      // Delete profile photos
      try {
        const photosDir = 'users/photos';
        const photoFiles = await readDir(photosDir, { baseDir: BaseDirectory.AppData });
        for (const file of photoFiles) {
          if (file.isFile && file.name.startsWith(`user_${userId}_`)) {
            await remove(`${photosDir}/${file.name}`, { baseDir: BaseDirectory.AppData });
          }
        }
      } catch (error) {
        console.log('No photos to delete');
      }

      // Delete signatures
      try {
        const sigDir = 'signatures';
        const sigFiles = await readDir(sigDir, { baseDir: BaseDirectory.AppData });
        for (const file of sigFiles) {
          if (file.isFile && file.name.includes(`user_signature_${userId}`)) {
            await remove(`${sigDir}/${file.name}`, { baseDir: BaseDirectory.AppData });
          }
        }
      } catch (error) {
        console.log('No signatures to delete');
      }
    }

    // Clear user DB connection and logout
    const { clearUserDatabase } = await import('./db');
    clearUserDatabase();
    logout();
  } catch (error) {
    await db.execute('ROLLBACK');
    console.error('Error deleting account:', error);
    throw error;
  }
}

/**
 * Reset all data (delete database and recreate)
 */
export async function resetAllData(): Promise<void> {
  if (!isTauri()) {
    throw new Error('Data reset is only available in Tauri environment');
  }

  const { remove, readDir, BaseDirectory } = await import('@tauri-apps/plugin-fs');

  try {
    // Delete database (this will reset the connection)
    await deleteDatabase();

    // Delete all files
    const directoriesToClean = ['signatures', 'users/photos', 'company/logos', 'receipts/photos'];

    for (const dir of directoriesToClean) {
      try {
        const files = await readDir(dir, { baseDir: BaseDirectory.AppData });
        for (const file of files) {
          if (file.isFile) {
            await remove(`${dir}/${file.name}`, { baseDir: BaseDirectory.AppData });
          }
        }
      } catch (error) {
        // Directory might not exist, that's okay
        console.log(`Directory ${dir} not found or already empty`);
      }
    }

    // Reinitialize database
    await getDatabase();
  } catch (error) {
    console.error('Error resetting data:', error);
    throw error;
  }
}
