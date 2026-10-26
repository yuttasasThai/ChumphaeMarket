/**
 * Backend Admin Authentication & Security Handler
 * Secure server-side credential verification (no client-side hardcoded passwords)
 */
import crypto from 'crypto';

// In-memory or env-backed server credential configuration
const SERVER_SECRET = process.env.ADMIN_SESSION_SECRET || 'chumphae_store_secure_salt_2026';
let currentAdminPasswordHash = crypto
  .createHash('sha256')
  .update('0992256601' + SERVER_SECRET)
  .digest('hex');

// Allowable admin usernames
const VALID_USERNAMES = ['admin', '0992256601', 'yuttasas.62@gmail.com'];

// Active valid session tokens set with expiry (24 hours)
const activeSessions = new Map<string, { username: string; expiresAt: number }>();

export interface LoginResult {
  success: boolean;
  token?: string;
  error?: string;
  user?: {
    username: string;
    role: 'admin';
  };
}

export function verifyAdminPassword(username: string, passwordAttempt: string): LoginResult {
  if (!username || !passwordAttempt) {
    return { success: false, error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' };
  }

  const cleanUser = username.trim().toLowerCase();
  const isValidUser = VALID_USERNAMES.includes(cleanUser);

  const attemptHash = crypto
    .createHash('sha256')
    .update(passwordAttempt.trim() + SERVER_SECRET)
    .digest('hex');

  const isPasswordCorrect = attemptHash === currentAdminPasswordHash;

  if (!isValidUser || !isPasswordCorrect) {
    return {
      success: false,
      error: 'ชื่อผู้ใช้หรือรหัสผ่านผู้ดูแลร้านไม่ถูกต้อง (รหัสเริ่มต้นของร้านคือ 0992256601)',
    };
  }

  // Generate secure session token
  const tokenPayload = `${cleanUser}:${Date.now()}:${crypto.randomBytes(16).toString('hex')}`;
  const sessionToken = crypto
    .createHmac('sha256', SERVER_SECRET)
    .update(tokenPayload)
    .digest('hex');

  // Store session valid for 24 hours
  activeSessions.set(sessionToken, {
    username: cleanUser,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  });

  return {
    success: true,
    token: sessionToken,
    user: {
      username: cleanUser,
      role: 'admin',
    },
  };
}

export function validateSessionToken(token: string | null | undefined): boolean {
  if (!token) return false;
  const session = activeSessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return false;
  }
  return true;
}

export function revokeSessionToken(token: string): void {
  activeSessions.delete(token);
}

export function changeAdminPassword(oldPassword: string, newPassword: string): { success: boolean; error?: string } {
  const oldHash = crypto.createHash('sha256').update(oldPassword + SERVER_SECRET).digest('hex');
  if (oldHash !== currentAdminPasswordHash) {
    return { success: false, error: 'รหัสผ่านเดิมไม่ถูกต้อง' };
  }
  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: 'รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร' };
  }
  currentAdminPasswordHash = crypto.createHash('sha256').update(newPassword + SERVER_SECRET).digest('hex');
  return { success: true };
}
