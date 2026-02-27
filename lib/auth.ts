import {
  getDefaultDatabase,
  createUserDatabase,
  clearUserDatabase,
} from "./db";
import { isTauri } from "./utils";

export interface User {
  id: number;
  email: string;
  full_name: string;
  profile_photo_path: string | null;
  signature_path: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Hash password (simple implementation - in production use bcrypt or similar)
 */
function hashPassword(password: string): string {
  // Simple hash - in production, use proper hashing like bcrypt
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Sign up a new user
 */
export async function signup(
  email: string,
  password: string,
  fullName: string,
  signatureFile: File,
): Promise<number> {
  const db = await getDefaultDatabase();

  // Check if user already exists
  const existing = await db.select<{ id: number }[]>(
    "SELECT id FROM users WHERE email = $1",
    [email],
  );

  if (existing.length > 0) {
    throw new Error("User with this email already exists");
  }

  // Hash password
  const passwordHash = hashPassword(password);

  // Save signature file
  if (!isTauri()) {
    throw new Error("File operations are only available in Tauri environment");
  }

  const { writeFile, mkdir, BaseDirectory } =
    await import("@tauri-apps/plugin-fs");
  const signaturesDir = "signatures";
  await mkdir(signaturesDir, {
    baseDir: BaseDirectory.AppData,
    recursive: true,
  });

  const fileExtension = signatureFile.name.split(".").pop() || "png";
  const fileName = `user_signature_${Date.now()}.${fileExtension}`;
  const destPath = `${signaturesDir}/${fileName}`;

  const arrayBuffer = await signatureFile.arrayBuffer();
  const fileData = new Uint8Array(arrayBuffer);
  await writeFile(destPath, fileData, { baseDir: BaseDirectory.AppData });

  // Create user in registry
  const result = await db.select<{ id: number }[]>(
    `INSERT INTO users (email, password_hash, full_name, signature_path, created_at, updated_at)
     VALUES ($1, $2, $3, $4, datetime('now'), datetime('now'))
     RETURNING id`,
    [email, passwordHash, fullName, destPath],
  );

  const userId = result[0].id;

  // Create dedicated workspace database for this user
  await createUserDatabase(userId);

  return userId;
}

/**
 * Login user
 */
export async function login(
  email: string,
  password: string,
): Promise<User | null> {
  const db = await getDefaultDatabase();
  const passwordHash = hashPassword(password);

  const users = await db.select<User[]>(
    `SELECT id, email, full_name, profile_photo_path, signature_path, is_active, created_at, updated_at
     FROM users
     WHERE email = $1 AND password_hash = $2 AND is_active = 1`,
    [email, passwordHash],
  );

  if (users.length === 0) {
    return null;
  }

  const user = users[0];
  return {
    ...user,
    is_active: Boolean(user.is_active),
  };
}

/**
 * Get current user from session (stored in localStorage for now)
 * Clears stale session if user is not found
 */
export async function getCurrentUser(): Promise<User | null> {
  if (typeof window === "undefined") {
    return null;
  }

  const userId = localStorage.getItem("current_user_id");
  if (!userId) {
    return null;
  }

  try {
    const db = await getDefaultDatabase();
    const users = await db.select<User[]>(
      `SELECT id, email, full_name, profile_photo_path, signature_path, is_active, created_at, updated_at
       FROM users
       WHERE id = $1 AND is_active = 1`,
      [parseInt(userId)],
    );

    if (users.length === 0) {
      // User not found or inactive - clear stale session
      localStorage.removeItem("current_user_id");
      return null;
    }

    const user = users[0];
    return {
      ...user,
      is_active: Boolean(user.is_active),
    };
  } catch (error) {
    // On error, clear session to be safe
    console.error("Error getting current user:", error);
    localStorage.removeItem("current_user_id");
    return null;
  }
}

/**
 * Logout current user
 */
export function logout(): void {
  if (typeof window !== "undefined") {
    clearUserDatabase();
    localStorage.removeItem("current_user_id");
  }
}

/**
 * Set current user session
 */
export function setCurrentUser(userId: number): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("current_user_id", userId.toString());
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: number,
  updates: {
    full_name?: string;
    profile_photo_path?: string | null;
    signature_path?: string | null;
  },
): Promise<void> {
  const db = await getDefaultDatabase();
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  if (updates.full_name !== undefined) {
    fields.push(`full_name = $${paramIndex++}`);
    values.push(updates.full_name);
  }
  if (updates.profile_photo_path !== undefined) {
    fields.push(`profile_photo_path = $${paramIndex++}`);
    values.push(updates.profile_photo_path);
  }
  if (updates.signature_path !== undefined) {
    fields.push(`signature_path = $${paramIndex++}`);
    values.push(updates.signature_path);
  }

  if (fields.length === 0) {
    return;
  }

  fields.push(`updated_at = datetime('now')`);
  values.push(userId);

  await db.execute(
    `UPDATE users SET ${fields.join(", ")} WHERE id = $${paramIndex}`,
    values,
  );
}

/**
 * Upload user profile photo
 */
export async function uploadUserProfilePhoto(
  userId: number,
  photoFile: File,
): Promise<string> {
  if (!isTauri()) {
    throw new Error("File upload is only available in Tauri environment");
  }

  const { writeFile, mkdir, BaseDirectory } =
    await import("@tauri-apps/plugin-fs");
  const photosDir = "users/photos";
  await mkdir(photosDir, { baseDir: BaseDirectory.AppData, recursive: true });

  const fileExtension = photoFile.name.split(".").pop() || "png";
  const fileName = `user_${userId}_${Date.now()}.${fileExtension}`;
  const destPath = `${photosDir}/${fileName}`;

  const arrayBuffer = await photoFile.arrayBuffer();
  const fileData = new Uint8Array(arrayBuffer);
  await writeFile(destPath, fileData, { baseDir: BaseDirectory.AppData });

  await updateUserProfile(userId, { profile_photo_path: destPath });

  return destPath;
}

/**
 * Upload user signature
 */
export async function uploadUserSignature(
  userId: number,
  signatureFile: File,
): Promise<string> {
  if (!isTauri()) {
    throw new Error("File upload is only available in Tauri environment");
  }

  const { writeFile, mkdir, BaseDirectory } =
    await import("@tauri-apps/plugin-fs");
  const signaturesDir = "signatures";
  await mkdir(signaturesDir, {
    baseDir: BaseDirectory.AppData,
    recursive: true,
  });

  const fileExtension = signatureFile.name.split(".").pop() || "png";
  const fileName = `user_signature_${userId}_${Date.now()}.${fileExtension}`;
  const destPath = `${signaturesDir}/${fileName}`;

  const arrayBuffer = await signatureFile.arrayBuffer();
  const fileData = new Uint8Array(arrayBuffer);
  await writeFile(destPath, fileData, { baseDir: BaseDirectory.AppData });

  await updateUserProfile(userId, { signature_path: destPath });

  return destPath;
}

/**
 * Get user profile photo as data URL
 */
export async function getUserProfilePhotoDataUrl(
  userId: number,
): Promise<string | null> {
  const db = await getDefaultDatabase();
  const users = await db.select<{ profile_photo_path: string | null }[]>(
    "SELECT profile_photo_path FROM users WHERE id = $1",
    [userId],
  );

  if (!users[0]?.profile_photo_path) {
    return null;
  }

  if (!isTauri()) {
    return null;
  }

  try {
    const { readFile, BaseDirectory } = await import("@tauri-apps/plugin-fs");
    const fileData = await readFile(users[0].profile_photo_path, {
      baseDir: BaseDirectory.AppData,
    });
    const bytes = new Uint8Array(fileData);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binary);

    const ext = users[0].profile_photo_path.split(".").pop()?.toLowerCase();
    let mimeType = "image/png";
    if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
    else if (ext === "gif") mimeType = "image/gif";
    else if (ext === "webp") mimeType = "image/webp";
    else if (ext === "svg") mimeType = "image/svg+xml";

    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error("Error reading profile photo:", error);
    return null;
  }
}

/**
 * Get user signature as data URL
 */
export async function getUserSignatureDataUrl(
  userId: number,
): Promise<string | null> {
  const db = await getDefaultDatabase();
  const users = await db.select<{ signature_path: string | null }[]>(
    "SELECT signature_path FROM users WHERE id = $1",
    [userId],
  );

  if (!users[0]?.signature_path) {
    return null;
  }

  if (!isTauri()) {
    return null;
  }

  try {
    const { readFile, BaseDirectory } = await import("@tauri-apps/plugin-fs");
    const fileData = await readFile(users[0].signature_path, {
      baseDir: BaseDirectory.AppData,
    });
    const bytes = new Uint8Array(fileData);
    let binary = "";
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binary);

    const ext = users[0].signature_path.split(".").pop()?.toLowerCase();
    let mimeType = "image/png";
    if (ext === "jpg" || ext === "jpeg") mimeType = "image/jpeg";
    else if (ext === "gif") mimeType = "image/gif";
    else if (ext === "webp") mimeType = "image/webp";
    else if (ext === "svg") mimeType = "image/svg+xml";

    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error("Error reading signature:", error);
    return null;
  }
}

/**
 * Get all user emails (for auto-fill purposes)
 */
export async function getAllUserEmails(): Promise<string[]> {
  const db = await getDefaultDatabase();
  const users = await db.select<{ email: string }[]>(
    "SELECT email FROM users WHERE is_active = 1 ORDER BY created_at DESC",
  );
  return users.map((u) => u.email);
}

/**
 * Generate a password reset token
 */
export async function generatePasswordResetToken(
  email: string,
): Promise<string> {
  const db = await getDefaultDatabase();

  // Find user by email
  const users = await db.select<{ id: number }[]>(
    "SELECT id FROM users WHERE email = $1 AND is_active = 1",
    [email],
  );

  if (users.length === 0) {
    throw new Error("User not found");
  }

  const userId = users[0].id;

  // Generate a secure token (no spaces/special chars that break URLs)
  const token = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}-${Math.random().toString(36).substring(2, 15)}`;

  // Token expires in 24 hours (UTC) so copied token can be used later
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Invalidate any existing tokens for this user
  await db.execute(
    "UPDATE password_reset_tokens SET used = 1 WHERE user_id = $1 AND used = 0",
    [userId],
  );

  // Create new token - store expiry as ISO UTC string
  await db.execute(
    `INSERT INTO password_reset_tokens (user_id, token, expires_at, created_at)
     VALUES ($1, $2, $3, datetime('now'))`,
    [userId, token, expiresAt.toISOString()],
  );

  return token;
}

/**
 * Validate password reset token
 * Trims token so pasted/copied values with stray spaces still work.
 */
export async function validatePasswordResetToken(
  token: string,
): Promise<number | null> {
  const db = await getDefaultDatabase();
  const trimmed = (token || "").trim();
  if (!trimmed) return null;

  const tokens = await db.select<
    { user_id: number; expires_at: string; used: number }[]
  >(
    `SELECT user_id, expires_at, used FROM password_reset_tokens 
     WHERE token = $1 AND used = 0`,
    [trimmed],
  );

  if (tokens.length === 0) {
    return null;
  }

  const tokenData = tokens[0];

  // Parse expiry as UTC (ISO string or "YYYY-MM-DD HH:MM:SS") and compare to now
  const expiresAtMs = new Date(tokenData.expires_at).getTime();
  const nowMs = Date.now();
  if (Number.isNaN(expiresAtMs) || expiresAtMs < nowMs) {
    return null;
  }

  return tokenData.user_id;
}

/**
 * Reset password using token
 * Token is trimmed so pasted/copied values work.
 */
export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<void> {
  const db = await getDefaultDatabase();
  const trimmed = (token || "").trim();
  if (!trimmed) throw new Error("Invalid or expired reset token");

  const userId = await validatePasswordResetToken(trimmed);
  if (!userId) {
    throw new Error("Invalid or expired reset token");
  }

  if (newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters long");
  }

  // Hash new password
  const passwordHash = hashPassword(newPassword);

  // Update password
  await db.execute(
    `UPDATE users SET password_hash = $1, updated_at = datetime('now') WHERE id = $2`,
    [passwordHash, userId],
  );

  // Mark token as used
  await db.execute(
    "UPDATE password_reset_tokens SET used = 1 WHERE token = $1",
    [trimmed],
  );
}

/**
 * Change password for logged-in user
 */
export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const db = await getDefaultDatabase();

  if (newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters long");
  }

  // Verify current password
  const passwordHash = hashPassword(currentPassword);
  const users = await db.select<{ id: number }[]>(
    "SELECT id FROM users WHERE id = $1 AND password_hash = $2",
    [userId, passwordHash],
  );

  if (users.length === 0) {
    throw new Error("Current password is incorrect");
  }

  // Update password
  const newPasswordHash = hashPassword(newPassword);
  await db.execute(
    `UPDATE users SET password_hash = $1, updated_at = datetime('now') WHERE id = $2`,
    [newPasswordHash, userId],
  );
}
