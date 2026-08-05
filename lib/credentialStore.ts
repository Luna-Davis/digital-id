// lib/credentialStore.ts
//
// The on-device credential vault.
//
//   - The credential data is AES-256-GCM encrypted and written to a file in
//     the app's private sandbox (`Paths.document`). Only this app can reach it.
//   - The AES key lives in expo-secure-store (iOS Keychain / Android Keystore).
//   - The credential file is WRITE-ONCE: `provisionCredential` refuses to run
//     if the lock file already exists, and a SHA-256 integrity hash is stored
//     in SecureStore so any rewrite or tampering is detected on read.
//   - The portrait photo is stored separately (also encrypted) and CAN be
//     replaced via `updatePhoto`, per the product requirement.

import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import type { CredentialData, CropRect } from './credentialTypes';
import { EMPTY_CREDENTIAL } from './credentialTypes';
import {
  generateAesKey,
  encryptBytes,
  decryptBytes,
  sha256Hex,
  packFile,
  unpackFile,
  encodeUtf8,
  decodeUtf8,
} from './crypto';

const KEY_ITEM = 'digital-id.aes-key';
const HASH_ITEM = 'digital-id.credential-hash';
const CROP_ITEM = 'digital-id.photo-crop';
const LOCK_NAME = 'credential.lock';
const PHOTO_NAME = 'photo.bin';
const MAGIC_LOCK: [number, number] = [0x49, 0x44]; // "ID"
const MAGIC_PHOTO: [number, number] = [0x49, 0x50]; // "IP"
const FORMAT_VERSION = 1;

const lockFile = () => new File(Paths.document, LOCK_NAME);
const photoFile = () => new File(Paths.document, PHOTO_NAME);

/** True when a credential has been provisioned (lock file exists). */
export function isProvisioned(): boolean {
  return lockFile().exists;
}

/** True when a portrait has been stored. */
export function hasPhoto(): boolean {
  return photoFile().exists;
}

async function getOrCreateKey(): Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY_ITEM);
  if (existing) return existing;
  const key = generateAesKey();
  await SecureStore.setItemAsync(KEY_ITEM, key);
  return key;
}

/**
 * One-time provisioning. Throws if a credential already exists — the
 * credential data is immutable and can never be rewritten.
 *
 * @param data      The confirmed identity data to lock.
 * @param photoUri  Optional local image URI to store as the portrait.
 */
export async function provisionCredential(
  data: CredentialData,
  photoUri?: string,
  crop?: CropRect,
): Promise<void> {
  const file = lockFile();
  if (file.exists) {
    throw new Error('A credential is already provisioned. It is immutable and cannot be rewritten.');
  }

  const key = await getOrCreateKey();
  const payload = encodeUtf8(JSON.stringify(data));
  const blob = encryptBytes(payload, key);
  const fileBytes = packFile(blob, MAGIC_LOCK, FORMAT_VERSION);

  // Build fully in memory, then write once. Lock file first…
  file.write(fileBytes);

  // …then the tamper-evident hash, immediately — so the credential can never
  // exist without its integrity anchor.
  await SecureStore.setItemAsync(HASH_ITEM, sha256Hex(fileBytes));

  // The portrait is optional and replaceable later; a failure here must not
  // block or corrupt the locked credential.
  if (photoUri) {
    try {
      await writePhotoBytes(photoUri, key, crop);
    } catch (e) {
      console.warn('Portrait could not be stored; it can be added later.', e);
    }
  }
}

/** Reads and verifies the credential. Throws on tampering / missing state. */
export async function readCredential(): Promise<CredentialData> {
  const file = lockFile();
  if (!file.exists) {
    throw new Error('No credential provisioned.');
  }
  const key = await SecureStore.getItemAsync(KEY_ITEM);
  if (!key) {
    throw new Error('Credential key is missing from secure storage.');
  }

  const bytes = new Uint8Array(await file.bytes());
  const storedHash = await SecureStore.getItemAsync(HASH_ITEM);
  if (storedHash && sha256Hex(bytes) !== storedHash) {
    throw new Error('Credential integrity check failed — the file may have been tampered with.');
  }

  const blob = unpackFile(bytes, MAGIC_LOCK, FORMAT_VERSION);
  const plain = decryptBytes(blob, key);
  // Merge over the empty shape so credentials written before new fields were
  // added (serialNumber/mrz/dateOfIssue) still read cleanly.
  return { ...EMPTY_CREDENTIAL, ...(JSON.parse(decodeUtf8(plain)) as Partial<CredentialData>) };
}

/**
 * Replaces the portrait. The photo is updatable even after the credential
 * data is locked. The new image is re-encrypted with the same key.
 */
export async function updatePhoto(sourceUri: string, crop?: CropRect): Promise<void> {
  const key = await getOrCreateKey();
  await writePhotoBytes(sourceUri, key, crop);
}

async function writePhotoBytes(sourceUri: string, key: string, crop?: CropRect): Promise<void> {
  const source = new File(sourceUri);
  const bytes = new Uint8Array(await source.bytes());
  const blob = encryptBytes(bytes, key);
  photoFile().write(packFile(blob, MAGIC_PHOTO, FORMAT_VERSION));

  // The crop rect is photo metadata (updatable with the photo, not the
  // immutable identity data) — stored in SecureStore alongside the key/hash.
  if (crop) {
    await SecureStore.setItemAsync(CROP_ITEM, JSON.stringify(crop));
  } else {
    await SecureStore.deleteItemAsync(CROP_ITEM);
  }
}

/** Returns the stored portrait crop rect, or null when none was saved. */
export async function getPhotoCrop(): Promise<CropRect | null> {
  const raw = await SecureStore.getItemAsync(CROP_ITEM);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CropRect;
  } catch {
    return null;
  }
}

/**
 * Decrypts the portrait into a preview file in the app cache directory and
 * returns its URI (for <Image source>). Returns null when there is no photo.
 *
 * Each call writes to a UNIQUE filename — React Native's <Image> caches by
 * URI, so a fixed preview name would keep serving the stale previous portrait
 * after `updatePhoto`. Old previews are swept afterwards (the cache directory
 * is app-private and system-cleanable anyway).
 */
export async function getPhotoUri(): Promise<string | null> {
  const file = photoFile();
  if (!file.exists) return null;

  const key = await SecureStore.getItemAsync(KEY_ITEM);
  if (!key) return null;

  const bytes = new Uint8Array(await file.bytes());
  const blob = unpackFile(bytes, MAGIC_PHOTO, FORMAT_VERSION);
  const plain = decryptBytes(blob, key);

  const preview = new File(Paths.cache, `photo-preview-${Date.now()}.img`);
  preview.write(plain);

  // Remove older preview copies so the cache doesn't grow on every update.
  try {
    for (const entry of Paths.cache.list()) {
      if (entry.name.startsWith('photo-preview-') && entry.uri !== preview.uri) {
        entry.delete();
      }
    }
  } catch {
    // Non-fatal: stale previews are just cleanable cache junk.
  }

  return preview.uri;
}
