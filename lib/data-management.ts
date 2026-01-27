import { getDatabase, deleteDatabase } from './db';
import { isTauri } from './utils';
import { logout } from './auth';
import Database from '@tauri-apps/plugin-sql';

const DB_NAME = 'lba_receipts.db';

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

/**
 * Create a backup of all data (database + files)
 */
export async function createBackup(): Promise<string> {
  if (!isTauri()) {
    throw new Error('Backup is only available in Tauri environment');
  }

  const { readFile, readDir, BaseDirectory } = await import('@tauri-apps/plugin-fs');
  const { save } = await import('@tauri-apps/plugin-dialog');

  try {
    // Read database file
    let dbData: Uint8Array;
    try {
      dbData = await readFile(DB_NAME, { baseDir: BaseDirectory.AppData });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('not found') || errorMessage.includes('No such file')) {
        throw new Error('Database file not found. Please create some data first.');
      }
      throw error;
    }

    // Convert database to base64
    const dbBase64 = btoa(
      String.fromCharCode(...dbData)
    );

    // Read all files from signatures directory
    const signatures: { [key: string]: string } = {};
    try {
      const sigDir = 'signatures';
      const sigFiles = await readDir(sigDir, { baseDir: BaseDirectory.AppData });
      for (const file of sigFiles) {
        if (file.isFile) {
          const fileData = await readFile(`${sigDir}/${file.name}`, { baseDir: BaseDirectory.AppData });
          const base64 = btoa(String.fromCharCode(...fileData));
          signatures[file.name] = base64;
        }
      }
    } catch (error) {
      // Directory might not exist, that's okay
      console.log('No signatures directory found');
    }

    // Read all files from users/photos directory
    const photos: { [key: string]: string } = {};
    try {
      const photosDir = 'users/photos';
      const photoFiles = await readDir(photosDir, { baseDir: BaseDirectory.AppData });
      for (const file of photoFiles) {
        if (file.isFile) {
          const fileData = await readFile(`${photosDir}/${file.name}`, { baseDir: BaseDirectory.AppData });
          const base64 = btoa(String.fromCharCode(...fileData));
          photos[file.name] = base64;
        }
      }
    } catch (error) {
      console.log('No photos directory found');
    }

    // Read company logos
    const logos: { [key: string]: string } = {};
    try {
      const logosDir = 'company/logos';
      const logoFiles = await readDir(logosDir, { baseDir: BaseDirectory.AppData });
      for (const file of logoFiles) {
        if (file.isFile) {
          const fileData = await readFile(`${logosDir}/${file.name}`, { baseDir: BaseDirectory.AppData });
          const base64 = btoa(String.fromCharCode(...fileData));
          logos[file.name] = base64;
        }
      }
    } catch (error) {
      console.log('No logos directory found');
    }

    // Read receipt photos
    const receiptPhotos: { [key: string]: string } = {};
    try {
      const receiptPhotosDir = 'receipts/photos';
      const receiptPhotoFiles = await readDir(receiptPhotosDir, { baseDir: BaseDirectory.AppData });
      for (const file of receiptPhotoFiles) {
        if (file.isFile) {
          const fileData = await readFile(`${receiptPhotosDir}/${file.name}`, { baseDir: BaseDirectory.AppData });
          const base64 = btoa(String.fromCharCode(...fileData));
          receiptPhotos[file.name] = base64;
        }
      }
    } catch (error) {
      console.log('No receipt photos directory found');
    }

    // Create backup object
    const backup: BackupData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      database: dbBase64,
      files: {
        signatures,
        photos,
        logos,
        receiptPhotos,
      },
    };

    // Convert to JSON
    const backupJson = JSON.stringify(backup, null, 2);

    // Save to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const defaultPath = `mnb-backup-${timestamp}.json`;

    const filePath = await save({
      defaultPath,
      filters: [
        {
          name: 'Backup Files',
          extensions: ['json'],
        },
      ],
    });

    if (!filePath) {
      throw new Error('Backup cancelled');
    }

    // Write backup file
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    await writeTextFile(filePath, backupJson);

    return filePath;
  } catch (error) {
    console.error('Error creating backup:', error);
    throw error;
  }
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
    await writeFile(DB_NAME, dbData, { baseDir: BaseDirectory.AppData });

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
  const db = await getDatabase();

  try {
    await db.execute('BEGIN TRANSACTION');

    // Delete user's receipts (if any are associated with this user)
    // Note: Receipts are associated with LBA units, not directly with users
    // But we can delete user-specific data like profile photos and signatures

    // Delete user's password reset tokens
    await db.execute('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);

    // Delete user account
    await db.execute('DELETE FROM users WHERE id = $1', [userId]);

    await db.execute('COMMIT');

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

    // Logout user
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
