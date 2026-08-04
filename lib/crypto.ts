// lib/crypto.ts
//
// Symmetric crypto for the encrypted credential vault.
// Uses react-native-quick-crypto (native, New-Architecture compatible) for
// AES-256-GCM + SHA-256, and react-native-quick-base64 for key encoding.
//
// All secrets are derived from one 256-bit key kept in expo-secure-store.
// AES-GCM gives us authenticated encryption: the auth tag makes any
// tampering with the ciphertext detectable on read.

import crypto, { Buffer } from 'react-native-quick-crypto';
import { fromByteArray, toByteArray } from 'react-native-quick-base64';

/** Generates a fresh 256-bit AES key, base64-encoded for SecureStore. */
export function generateAesKey(): string {
  return fromByteArray(crypto.randomBytes(32));
}

export type EncryptedBlob = {
  iv: Uint8Array;
  tag: Uint8Array;
  ciphertext: Uint8Array;
};

/** Encrypts bytes with AES-256-GCM. Returns a fresh random IV + auth tag + ciphertext. */
export function encryptBytes(plaintext: Uint8Array, keyB64: string): EncryptedBlob {
  const key = Buffer.from(toByteArray(keyB64));
  const iv = Buffer.from(crypto.randomBytes(12));
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plaintext)), cipher.final()]);
  return {
    iv: new Uint8Array(iv),
    tag: new Uint8Array(cipher.getAuthTag()),
    ciphertext: new Uint8Array(ciphertext),
  };
}

/** Decrypts an AES-256-GCM blob. Throws if the auth tag is invalid (tampered data). */
export function decryptBytes(blob: EncryptedBlob, keyB64: string): Uint8Array {
  const key = Buffer.from(toByteArray(keyB64));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(blob.iv));
  decipher.setAuthTag(Buffer.from(blob.tag));
  const plain = Buffer.concat([decipher.update(Buffer.from(blob.ciphertext)), decipher.final()]);
  return new Uint8Array(plain);
}

/** SHA-256 digest of arbitrary bytes, hex-encoded. Used for integrity checks. */
export function sha256Hex(data: Uint8Array): string {
  const digest = crypto.createHash('sha256').update(Buffer.from(data)).digest();
  return toHex(new Uint8Array(digest));
}

function toHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/** Concatenates byte arrays into a single Uint8Array. */
export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/**
 * On-disk file format: [ magic (2) | version (1) | iv (12) | auth tag (16) | ciphertext ].
 * The magic byte pair lets us validate the file type, the version allows future migrations.
 */
export function packFile(blob: EncryptedBlob, magic: [number, number], version: number): Uint8Array {
  return concatBytes(
    Uint8Array.from([magic[0], magic[1], version]),
    blob.iv,
    blob.tag,
    blob.ciphertext,
  );
}

export function unpackFile(bytes: Uint8Array, magic: [number, number], version: number): EncryptedBlob {
  if (bytes.length < 3 + 12 + 16) {
    throw new Error('Encrypted file is corrupted (too short).');
  }
  if (bytes[0] !== magic[0] || bytes[1] !== magic[1]) {
    throw new Error('Encrypted file has an invalid header.');
  }
  if (bytes[2] !== version) {
    throw new Error(`Encrypted file has an unsupported format version (${bytes[2]}).`);
  }
  const iv = bytes.slice(3, 3 + 12);
  const tag = bytes.slice(3 + 12, 3 + 12 + 16);
  const ciphertext = bytes.slice(3 + 12 + 16);
  return { iv, tag, ciphertext };
}

// --- UTF-8 helpers (Hermes-safe, avoids TextEncoder availability questions) ---

export function encodeUtf8(str: string): Uint8Array {
  const encoded = unescape(encodeURIComponent(str));
  const bytes = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i++) {
    bytes[i] = encoded.charCodeAt(i);
  }
  return bytes;
}

export function decodeUtf8(bytes: Uint8Array): string {
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return decodeURIComponent(escape(str));
}
