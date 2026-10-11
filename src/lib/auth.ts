import * as OTPAuth from 'otpauth';
import { getDB } from './db';

const AUTH_STORE = 'auth';
const SESSION_KEY = 'sv-session';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

// ── Storage helpers ─────────────────────────────────────────
interface AuthRecord {
  id: 'primary';
  username: string;
  passwordHash: string;
  passwordSalt: string;
  totpSecret: string | null;
  totpEnabled: boolean;
  failedAttempts: number;
  lockedUntil: number;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_USERNAME = 'admin';
let DEFAULT_PASSWORD = 'CHANGE_ME_ON_FIRST_LOGIN';
try {
  // @ts-ignore — optional local file
  const local = await import('./auth.local');
  if (local?.LOCAL_DEFAULT_PASSWORD) DEFAULT_PASSWORD = local.LOCAL_DEFAULT_PASSWORD;
} catch {}

async function getAuthStore() {
  const db = await getDB();
  if (!db.objectStoreNames.contains(AUTH_STORE)) {
    throw new Error('auth object store missing — needs DB upgrade');
  }
  return db;
}

export async function getAuthRecord(): Promise<AuthRecord | undefined> {
  const db = await getAuthStore();
  return db.get(AUTH_STORE, 'primary');
}

async function putAuthRecord(rec: AuthRecord) {
  const db = await getAuthStore();
  await db.put(AUTH_STORE, rec);
}

// ── Password hashing (PBKDF2 via Web Crypto API) ────────────
function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuf(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

export async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const enc = new TextEncoder();
  const salt = saltHex ? hexToBuf(saltHex) : crypto.getRandomValues(new Uint8Array(16));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return { hash: bufToHex(bits), salt: bufToHex(salt.buffer) };
}

// ── Initialize on first run ─────────────────────────────────
export async function initAuth(): Promise<void> {
  const existing = await getAuthRecord();
  if (existing) return;

  const { hash, salt } = await hashPassword(DEFAULT_PASSWORD);
  const rec: AuthRecord = {
    id: 'primary',
    username: DEFAULT_USERNAME,
    passwordHash: hash,
    passwordSalt: salt,
    totpSecret: null,
    totpEnabled: false,
    failedAttempts: 0,
    lockedUntil: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await putAuthRecord(rec);
  console.log('[auth] Initialized with default credentials — see setup docs');
}

// ── Rate limiting ───────────────────────────────────────────
export function getLockoutRemaining(rec: AuthRecord): number {
  if (!rec.lockedUntil) return 0;
  return Math.max(0, rec.lockedUntil - Date.now());
}

async function recordFailure(rec: AuthRecord): Promise<AuthRecord> {
  const attempts = rec.failedAttempts + 1;
  const locked = attempts >= MAX_ATTEMPTS;
  const updated: AuthRecord = {
    ...rec,
    failedAttempts: locked ? 0 : attempts,
    lockedUntil: locked ? Date.now() + LOCKOUT_MS : rec.lockedUntil,
    updatedAt: new Date().toISOString(),
  };
  await putAuthRecord(updated);
  return updated;
}

async function clearFailures(rec: AuthRecord): Promise<AuthRecord> {
  const updated: AuthRecord = {
    ...rec,
    failedAttempts: 0,
    lockedUntil: 0,
    updatedAt: new Date().toISOString(),
  };
  await putAuthRecord(updated);
  return updated;
}

// ── Login flow ──────────────────────────────────────────────
export interface LoginResult {
  ok: boolean;
  error?: string;
  needsTotp?: boolean;
  lockoutMs?: number;
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const rec = await getAuthRecord();
  if (!rec) return { ok: false, error: 'Auth not initialized' };

  const lockRemaining = getLockoutRemaining(rec);
  if (lockRemaining > 0) {
    return { ok: false, error: 'Account locked', lockoutMs: lockRemaining };
  }

  if (username.trim().toLowerCase() !== rec.username.toLowerCase()) {
    const updated = await recordFailure(rec);
    const lockRemaining = getLockoutRemaining(updated);
    if (lockRemaining > 0) return { ok: false, error: 'Account locked', lockoutMs: lockRemaining };
    return { ok: false, error: 'Invalid credentials' };
  }

  const { hash } = await hashPassword(password, rec.passwordSalt);
  if (hash !== rec.passwordHash) {
    const updated = await recordFailure(rec);
    const lockRemaining = getLockoutRemaining(updated);
    if (lockRemaining > 0) return { ok: false, error: 'Account locked', lockoutMs: lockRemaining };
    const remaining = MAX_ATTEMPTS - updated.failedAttempts;
    return { ok: false, error: `Invalid credentials (${remaining} attempts left)` };
  }

  await clearFailures(rec);

  if (rec.totpEnabled) {
    return { ok: false, needsTotp: true };
  }

  createSession();
  return { ok: true };
}

export async function verifyTotp(code: string): Promise<{ ok: boolean; error?: string }> {
  const rec = await getAuthRecord();
  if (!rec || !rec.totpSecret || !rec.totpEnabled) {
    return { ok: false, error: '2FA not configured' };
  }

  const totp = new OTPAuth.TOTP({
    issuer: 'SecureVision AI',
    label: rec.username,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(rec.totpSecret),
  });
  const delta = totp.validate({ token: code.trim(), window: 1 });
  if (delta === null) {
    return { ok: false, error: 'Invalid 2FA code' };
  }
  createSession();
  return { ok: true };
}

// ── Sessions ────────────────────────────────────────────────
interface Session {
  token: string;
  expiresAt: number;
  createdAt: number;
}

export function createSession(): void {
  const token = crypto.randomUUID();
  const session: Session = {
    token,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getSession(): Session | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Session;
    if (Date.now() > s.expiresAt) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function logout(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

// ── Password change ─────────────────────────────────────────
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  const rec = await getAuthRecord();
  if (!rec) return { ok: false, error: 'Auth not initialized' };

  const { hash } = await hashPassword(currentPassword, rec.passwordSalt);
  if (hash !== rec.passwordHash) {
    return { ok: false, error: 'Current password is incorrect' };
  }
  if (newPassword.length < 10) {
    return { ok: false, error: 'Password must be at least 10 characters' };
  }

  const { hash: newHash, salt: newSalt } = await hashPassword(newPassword);
  await putAuthRecord({
    ...rec,
    passwordHash: newHash,
    passwordSalt: newSalt,
    updatedAt: new Date().toISOString(),
  });
  return { ok: true };
}

// ── 2FA management ──────────────────────────────────────────
export async function generateTotpSecret(): Promise<{ secret: string; otpauth: string }> {
  const rec = await getAuthRecord();
  if (!rec) throw new Error('Auth not initialized');

  const secret = new OTPAuth.Secret({ size: 20 });
  const totp = new OTPAuth.TOTP({
    issuer: 'SecureVision AI',
    label: rec.username,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  });
  return { secret: secret.base32, otpauth: totp.toString() };
}

export async function enableTotp(secret: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const rec = await getAuthRecord();
  if (!rec) return { ok: false, error: 'Auth not initialized' };

  const totp = new OTPAuth.TOTP({
    issuer: 'SecureVision AI',
    label: rec.username,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  const delta = totp.validate({ token: code.trim(), window: 1 });
  if (delta === null) return { ok: false, error: 'Invalid code — try again' };

  await putAuthRecord({
    ...rec,
    totpSecret: secret,
    totpEnabled: true,
    updatedAt: new Date().toISOString(),
  });
  return { ok: true };
}

export async function disableTotp(password: string): Promise<{ ok: boolean; error?: string }> {
  const rec = await getAuthRecord();
  if (!rec) return { ok: false, error: 'Auth not initialized' };

  const { hash } = await hashPassword(password, rec.passwordSalt);
  if (hash !== rec.passwordHash) {
    return { ok: false, error: 'Password is incorrect' };
  }

  await putAuthRecord({
    ...rec,
    totpSecret: null,
    totpEnabled: false,
    updatedAt: new Date().toISOString(),
  });
  return { ok: true };
}
