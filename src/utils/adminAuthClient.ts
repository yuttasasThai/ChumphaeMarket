/**
 * Admin Authentication & Session Service
 * Provides client-side and server-fallback credential authentication
 * Enables seamless login on both Cloud Run production and Vite dev environments.
 */

const SERVER_SECRET = 'chumphae_store_secure_salt_2026';
const VALID_USERNAMES = ['admin', '0992256601', 'yuttasas.62@gmail.com'];
const DEFAULT_ADMIN_PASS = '0992256601';

export interface AdminUser {
  username: string;
  role: 'admin';
}

export interface AdminLoginResult {
  success: boolean;
  token?: string;
  error?: string;
  user?: AdminUser;
}

// Simple fast SHA-256 in browser or Node
async function sha256(message: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback string hash
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    const char = message.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

export async function loginAdminClient(
  usernameInput: string,
  passwordInput: string
): Promise<AdminLoginResult> {
  const username = usernameInput.trim().toLowerCase();
  const password = passwordInput.trim();

  if (!username || !password) {
    return { success: false, error: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' };
  }

  // 1. Try server endpoint first if available
  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const contentType = res.headers.get('content-type');
    if (res.ok && contentType && contentType.includes('application/json')) {
      const data = await res.json();
      if (data.success) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Backend /api/admin/login fetch error, falling back to client-side auth:', err);
  }

  // 2. Client-side authentication fallback (handles static hosting / Cloud Run preview routing)
  const isValidUsername = VALID_USERNAMES.includes(username);
  const isValidPassword = password === DEFAULT_ADMIN_PASS;

  if (isValidUsername && isValidPassword) {
    const token = await sha256(`${username}:${Date.now()}:${SERVER_SECRET}`);
    const result: AdminLoginResult = {
      success: true,
      token,
      user: {
        username,
        role: 'admin',
      },
    };
    return result;
  }

  return {
    success: false,
    error: 'ชื่อผู้ใช้หรือรหัสผ่านผู้ดูแลร้านไม่ถูกต้อง (รหัสเริ่มต้นของร้านคือ 0992256601)',
  };
}

export async function verifyAdminTokenClient(token: string | null): Promise<boolean> {
  if (!token) return false;
  // If stored in sessionStorage, token is considered valid for the tab session
  return true;
}
