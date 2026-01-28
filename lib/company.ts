import { getDatabase } from './db';
import { isTauri } from './utils';
import { writeFile, mkdir, readFile, BaseDirectory } from '@tauri-apps/plugin-fs';

export interface CompanySettings {
  id: number;
  company_name: string;
  company_logo_path: string | null;
  receipt_header_text: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  updated_at: string;
}

/**
 * Get company settings
 */
export async function getCompanySettings(): Promise<CompanySettings | null> {
  const db = await getDatabase();
  const settings = await db.select<CompanySettings[]>(
    'SELECT * FROM company_settings ORDER BY id LIMIT 1'
  );

  return settings.length > 0 ? settings[0] : null;
}

/**
 * Update company settings
 */
export async function updateCompanySettings(
  updates: {
    company_name?: string;
    company_logo_path?: string | null;
    receipt_header_text?: string;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    website?: string | null;
  }
): Promise<void> {
  const db = await getDatabase();
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.company_name !== undefined) {
    fields.push(`company_name = $${paramIndex++}`);
    values.push(updates.company_name);
  }
  if (updates.company_logo_path !== undefined) {
    fields.push(`company_logo_path = $${paramIndex++}`);
    values.push(updates.company_logo_path);
  }
  if (updates.receipt_header_text !== undefined) {
    fields.push(`receipt_header_text = $${paramIndex++}`);
    values.push(updates.receipt_header_text);
  }
  if (updates.address !== undefined) {
    fields.push(`address = $${paramIndex++}`);
    values.push(updates.address);
  }
  if (updates.phone !== undefined) {
    fields.push(`phone = $${paramIndex++}`);
    values.push(updates.phone);
  }
  if (updates.email !== undefined) {
    fields.push(`email = $${paramIndex++}`);
    values.push(updates.email);
  }
  if (updates.website !== undefined) {
    fields.push(`website = $${paramIndex++}`);
    values.push(updates.website);
  }

  if (fields.length === 0) {
    return;
  }

  fields.push(`updated_at = datetime('now')`);

  // Update or insert
  const existing = await db.select<{ id: number }[]>(
    'SELECT id FROM company_settings ORDER BY id LIMIT 1'
  );

  if (existing.length > 0) {
    values.push(existing[0].id);
    await db.execute(
      `UPDATE company_settings SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
  } else {
    await db.execute(
      `INSERT INTO company_settings (company_name, company_logo_path, receipt_header_text, updated_at)
       VALUES ($1, $2, $3, datetime('now'))`,
      [
        updates.company_name || 'MAN NO BE GOD COMPANY LIMITED',
        updates.company_logo_path || null,
        updates.receipt_header_text || 'MAN NO BE GOD COMPANY LIMITED',
      ]
    );
  }
}

/**
 * Upload company logo
 */
export async function uploadCompanyLogo(logoFile: File): Promise<string> {
  if (!isTauri()) {
    throw new Error('File upload is only available in Tauri environment');
  }

  const logosDir = 'company/logos';
  await mkdir(logosDir, { baseDir: BaseDirectory.AppData, recursive: true });

  const fileExtension = logoFile.name.split('.').pop() || 'png';
  const fileName = `company_logo_${Date.now()}.${fileExtension}`;
  const destPath = `${logosDir}/${fileName}`;

  const arrayBuffer = await logoFile.arrayBuffer();
  const fileData = new Uint8Array(arrayBuffer);
  await writeFile(destPath, fileData, { baseDir: BaseDirectory.AppData });

  await updateCompanySettings({ company_logo_path: destPath });

  return destPath;
}

/**
 * Get company logo as data URL
 */
export async function getCompanyLogoDataUrl(): Promise<string | null> {
  const settings = await getCompanySettings();
  if (!settings?.company_logo_path) {
    return null;
  }

  if (!isTauri()) {
    return null;
  }

  try {
    const fileData = await readFile(settings.company_logo_path, { baseDir: BaseDirectory.AppData });
    const bytes = new Uint8Array(fileData);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binary);

    const ext = settings.company_logo_path.split('.').pop()?.toLowerCase();
    let mimeType = 'image/png';
    if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
    else if (ext === 'gif') mimeType = 'image/gif';
    else if (ext === 'webp') mimeType = 'image/webp';
    else if (ext === 'svg') mimeType = 'image/svg+xml';

    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error('Error reading company logo:', error);
    return null;
  }
}
