// lib/lockStore.ts
//
// App-lock credential storage.
//
// The PIN is NEVER stored in plaintext: only a salted SHA-256 digest is kept,
// inside expo-secure-store (Keychain / Keystore — encrypted at rest). The salt
// is random per install. Failed attempts are tracked with a temporary lockout
// so an offline brute-force on the 4-digit space is impractical.

import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import QuickCrypto from 'react-native-quick-crypto';

const PIN_KEY = 'lock.pin.v1';
const ATTEMPTS_KEY = 'lock.attempts.v1';

export const PIN_LENGTH = 4;
export const MAX_ATTEMPTS = 5;
/** Lockout after MAX_ATTEMPTS consecutive failures. */
export const LOCKOUT_MS = 30_000;

type PinRecord = { salt: string; hash: string };
type AttemptRecord = { count: number; until: number | null };

export async function isPinSet(): Promise<boolean> {
  return (await SecureStore.getItemAsync(PIN_KEY)) != null;
}

export async function setPin(pin: string): Promise<void> {
  const salt = QuickCrypto.randomBytes(16).toString('hex');
  const hash = await hashPin(pin, salt);
  await SecureStore.setItemAsync(PIN_KEY, JSON.stringify({ salt, hash }));
  await SecureStore.deleteItemAsync(ATTEMPTS_KEY);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const raw = await SecureStore.getItemAsync(PIN_KEY);
  if (!raw) return false;
  try {
    const { salt, hash } = JSON.parse(raw) as PinRecord;
    return (await hashPin(pin, salt)) === hash;
  } catch {
    return false;
  }
}

async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

// --- failed-attempt tracking ------------------------------------------------

/** Current consecutive-failure count (0 once any lockout has expired). */
export async function getFailedAttempts(): Promise<number> {
  const raw = await SecureStore.getItemAsync(ATTEMPTS_KEY);
  if (!raw) return 0;
  try {
    const { count, until } = JSON.parse(raw) as AttemptRecord;
    if (until != null && Date.now() >= until) {
      await SecureStore.deleteItemAsync(ATTEMPTS_KEY);
      return 0;
    }
    return count;
  } catch {
    return 0;
  }
}

/** Active lockout expiry timestamp, or null when not currently locked out. */
export async function getLockoutUntil(): Promise<number | null> {
  const raw = await SecureStore.getItemAsync(ATTEMPTS_KEY);
  if (!raw) return null;
  try {
    const { until } = JSON.parse(raw) as AttemptRecord;
    if (until != null && Date.now() < until) return until;
    if (until != null) await SecureStore.deleteItemAsync(ATTEMPTS_KEY);
    return null;
  } catch {
    return null;
  }
}

/** Lockout expiry timestamp if this failure triggered the lockout, else null. */
export async function recordFailedAttempt(): Promise<number | null> {
  const count = (await getFailedAttempts()) + 1;
  const until = count >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : null;
  await SecureStore.setItemAsync(ATTEMPTS_KEY, JSON.stringify({ count, until }));
  return until;
}

export async function clearFailedAttempts(): Promise<void> {
  await SecureStore.deleteItemAsync(ATTEMPTS_KEY);
}
