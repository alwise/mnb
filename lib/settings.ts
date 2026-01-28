import { getDatabase } from './db';
import { getAllLBAUnits, createLBAUnit } from './receipts';
import type { LBAUnit } from '@/types';
import { isTauri } from './utils';

export interface AppSettings {
  adminSignaturePath?: string;
}

/**
 * Get app setting by key
 */
export async function getSetting(key: string): Promise<string | null> {
  const db = await getDatabase();
  const result = await db.select<{ setting_value: string }[]>(
    'SELECT setting_value FROM app_settings WHERE setting_key = $1',
    [key]
  );
  return result.length > 0 ? result[0].setting_value : null;
}

/**
 * Set app setting by key
 */
export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO app_settings (setting_key, setting_value, updated_at)
     VALUES ($1, $2, datetime('now'))
     ON CONFLICT(setting_key) DO UPDATE SET
       setting_value = $2,
       updated_at = datetime('now')`,
    [key, value]
  );
}

/**
 * Get admin signature path
 */
export async function getAdminSignaturePath(): Promise<string | null> {
  return await getSetting('admin_signature_path');
}

/**
 * Set admin signature path
 */
export async function setAdminSignaturePath(path: string): Promise<void> {
  await setSetting('admin_signature_path', path);
}

/**
 * Upload admin signature image
 */
export async function uploadAdminSignature(): Promise<string | null> {
  if (!isTauri()) {
    throw new Error('File upload is only available in Tauri environment');
  }

  try {
    // Dynamic imports to avoid issues in Next.js dev mode
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { readFile, writeFile, mkdir, BaseDirectory } = await import('@tauri-apps/plugin-fs');

    console.log('Opening file dialog...');
    // Open file dialog
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: 'Image',
          extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'],
        },
      ],
    });

    console.log('File dialog result:', selected);

    if (!selected || Array.isArray(selected)) {
      console.log('No file selected or multiple files returned');
      return null;
    }

    // Create signatures directory if it doesn't exist
    const signaturesDir = 'signatures';

    console.log('Creating signatures directory...');
    try {
      await mkdir(signaturesDir, { baseDir: BaseDirectory.AppData, recursive: true });
      console.log('Directory created or already exists');
    } catch (err) {
      // Directory might already exist, that's okay
      const errMsg = (err as Error).message || '';
      console.log('Directory creation result:', errMsg);
      if (!errMsg.includes('exists') && !errMsg.includes('already exists') && !errMsg.includes('EEXIST')) {
        throw err;
      }
    }

    // Generate unique filename
    const fileExtension = selected.split('.').pop() || 'png';
    const fileName = `admin_signature_${Date.now()}.${fileExtension}`;
    const destPath = `${signaturesDir}/${fileName}`;

    console.log('Reading source file:', selected);
    // Read source file - selected is an absolute path from the dialog
    // For absolute paths, we don't need baseDir
    let fileData: Uint8Array;
    try {
      fileData = await readFile(selected);
    } catch (err) {
      // If that fails, try with explicit path handling
      console.log('Direct read failed, trying alternative...', err);
      // The selected path should work directly, but if not, we might need to handle it differently
      throw new Error(`Failed to read file: ${(err as Error).message}`);
    }
    console.log('File read, size:', fileData.length);

    console.log('Writing to destination:', destPath);
    // Write to destination
    await writeFile(destPath, fileData, { baseDir: BaseDirectory.AppData });
    console.log('File written successfully');

    // Save relative path to database (we'll reconstruct full path when reading)
    await setAdminSignaturePath(destPath);
    console.log('Path saved to database:', destPath);

    return destPath;
  } catch (error) {
    console.error('Error uploading signature:', error);
    throw error;
  }
}

/**
 * Get admin signature as base64 data URL
 */
export async function getAdminSignatureDataUrl(): Promise<string | null> {
  const signaturePath = await getAdminSignaturePath();
  if (!signaturePath) {
    return null;
  }

  if (!isTauri()) {
    return null;
  }

  try {
    // Dynamic import to avoid issues in Next.js dev mode
    const { readFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');

    // Read file from app data directory
    const fileData = await readFile(signaturePath, { baseDir: BaseDirectory.AppData });

    // Convert to base64 - handle large files by chunking
    const bytes = new Uint8Array(fileData);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binary);

    // Determine MIME type from file extension
    const ext = signaturePath.split('.').pop()?.toLowerCase();
    let mimeType = 'image/png';
    if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
    else if (ext === 'gif') mimeType = 'image/gif';
    else if (ext === 'webp') mimeType = 'image/webp';
    else if (ext === 'svg') mimeType = 'image/svg+xml';

    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('Error reading signature file:', error);
    return null;
  }
}

/**
 * Get receipt photo path
 */
export async function getReceiptPhotoPath(receiptId: number): Promise<string | null> {
  return await getSetting(`receipt_photo_path_${receiptId}`);
}

/**
 * Set receipt photo path
 */
export async function setReceiptPhotoPath(receiptId: number, path: string): Promise<void> {
  await setSetting(`receipt_photo_path_${receiptId}`, path);
}

/**
 * Save receipt photo from File object
 */
export async function saveReceiptPhoto(receiptId: number, photoFile: File): Promise<string | null> {
  if (!isTauri()) {
    throw new Error('File upload is only available in Tauri environment');
  }

  try {
    // Dynamic imports to avoid issues in Next.js dev mode
    const { writeFile, mkdir, BaseDirectory } = await import('@tauri-apps/plugin-fs');

    // Create receipts/photos directory if it doesn't exist
    const photosDir = 'receipts/photos';

    try {
      await mkdir(photosDir, { baseDir: BaseDirectory.AppData, recursive: true });
    } catch (err) {
      const errMsg = (err as Error).message || '';
      if (!errMsg.includes('exists') && !errMsg.includes('already exists') && !errMsg.includes('EEXIST')) {
        throw err;
      }
    }

    // Generate filename
    const fileExtension = photoFile.name.split('.').pop() || 'png';
    const fileName = `receipt_${receiptId}_${Date.now()}.${fileExtension}`;
    const destPath = `${photosDir}/${fileName}`;

    // Convert File to Uint8Array
    const arrayBuffer = await photoFile.arrayBuffer();
    const fileData = new Uint8Array(arrayBuffer);

    // Write to destination
    await writeFile(destPath, fileData, { baseDir: BaseDirectory.AppData });

    // Save relative path to database
    await setReceiptPhotoPath(receiptId, destPath);

    return destPath;
  } catch (error) {
    console.error('Error saving receipt photo:', error);
    throw error;
  }
}

/**
 * Get receipt photo as base64 data URL
 */
export async function getReceiptPhotoDataUrl(receiptId: number): Promise<string | null> {
  const photoPath = await getReceiptPhotoPath(receiptId);
  if (!photoPath) {
    return null;
  }

  if (!isTauri()) {
    return null;
  }

  try {
    // Dynamic import to avoid issues in Next.js dev mode
    const { readFile, BaseDirectory } = await import('@tauri-apps/plugin-fs');

    // Read file from app data directory
    const fileData = await readFile(photoPath, { baseDir: BaseDirectory.AppData });

    // Convert to base64 - handle large files by chunking
    const bytes = new Uint8Array(fileData);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binary);

    // Determine MIME type from file extension
    const ext = photoPath.split('.').pop()?.toLowerCase();
    let mimeType = 'image/png';
    if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
    else if (ext === 'gif') mimeType = 'image/gif';
    else if (ext === 'webp') mimeType = 'image/webp';
    else if (ext === 'svg') mimeType = 'image/svg+xml';

    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('Error reading receipt photo file:', error);
    return null;
  }
}

/**
 * Get all LBA units for management
 */
export async function getAllLBAUnitsForManagement(): Promise<LBAUnit[]> {
  return await getAllLBAUnits();
}

/**
 * Create a new LBA unit
 */
export async function createLBAUnitForManagement(
  unit: Omit<LBAUnit, 'id' | 'created_at'>
): Promise<number> {
  return await createLBAUnit(unit);
}

/**
 * Update an existing LBA unit
 */
export async function updateLBAUnit(
  id: number,
  unit: Omit<LBAUnit, 'id' | 'created_at'>
): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `UPDATE lba_units SET
      unit = $1,
      lba_name = $2,
      crop = $3,
      season = $4,
      unit_head = $5,
      qci_name = $6,
      lba_code = $7
    WHERE id = $8`,
    [unit.unit, unit.lba_name, unit.crop, unit.season, unit.unit_head, unit.qci_name, unit.lba_code, id]
  );
}

/**
 * Delete an LBA unit
 */
export async function deleteLBAUnit(id: number): Promise<void> {
  const db = await getDatabase();
  // Check if unit has receipts
  const receipts = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM receipts WHERE lba_unit_id = $1',
    [id]
  );

  if (receipts[0]?.count > 0) {
    throw new Error(
      'Cannot delete LBA unit that has stock cards. Please delete all stock cards first.'
    );
  }

  await db.execute('DELETE FROM lba_units WHERE id = $1', [id]);
  // Also delete totals (should be handled by CASCADE, but just in case)
  await db.execute('DELETE FROM receipt_totals WHERE lba_unit_id = $1', [id]);
}
