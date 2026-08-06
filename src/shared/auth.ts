import { storage } from "./storage";
import type { PasswordRecord } from "./types";

const ITERATIONS = 210_000;
const encoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return bytesToBase64(new Uint8Array(bits));
}

export async function createPassword(password: string): Promise<PasswordRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const record: PasswordRecord = {
    salt: bytesToBase64(salt),
    hash: await derive(password, salt, ITERATIONS),
    iterations: ITERATIONS,
    createdAt: Date.now(),
  };
  await storage.setPassword(record);
  await storage.resetAuthThrottle();
  return record;
}

async function comparePassword(password: string): Promise<boolean> {
  const record = await storage.getPassword();
  if (!record) return false;
  const candidate = await derive(password, base64ToBytes(record.salt), record.iterations);
  if (candidate.length !== record.hash.length) return false;
  let difference = 0;
  for (let index = 0; index < candidate.length; index += 1) difference |= candidate.charCodeAt(index) ^ record.hash.charCodeAt(index);
  return difference === 0;
}

export interface AuthenticationResult {
  ok: boolean;
  retryAfterMs: number;
  failedAttempts: number;
}

export async function authenticatePassword(password: string): Promise<AuthenticationResult> {
  const throttle = await storage.getAuthThrottle();
  const now = Date.now();
  if (throttle.lockUntil > now) return { ok: false, retryAfterMs: throttle.lockUntil - now, failedAttempts: throttle.failedAttempts };
  if (await comparePassword(password)) {
    await storage.resetAuthThrottle();
    return { ok: true, retryAfterMs: 0, failedAttempts: 0 };
  }
  const failedAttempts = throttle.failedAttempts + 1;
  const delaySeconds = failedAttempts >= 5 ? Math.min(900, 30 * (2 ** (failedAttempts - 5))) : 0;
  const lockUntil = delaySeconds ? now + delaySeconds * 1000 : 0;
  await storage.setAuthThrottle({ failedAttempts, lockUntil });
  return { ok: false, retryAfterMs: delaySeconds * 1000, failedAttempts };
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<AuthenticationResult> {
  const authentication = await authenticatePassword(currentPassword);
  if (!authentication.ok) return authentication;
  await createPassword(newPassword);
  return authentication;
}

export function validateNewPassword(password: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "Include at least one letter and one number.";
  return null;
}
