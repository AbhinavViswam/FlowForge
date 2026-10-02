import crypto from 'crypto';

// Symmetric encryption for user secrets (e.g. SMTP app passwords) stored at rest.
// Format: "v1:<ivBase64>:<authTagBase64>:<ciphertextBase64>", AES-256-GCM.
//
// The key comes from ENCRYPTION_KEY (any string). We derive a stable 32-byte key
// via SHA-256 so operators can use a passphrase or a hex/base64 key interchangeably.
// IMPORTANT: changing ENCRYPTION_KEY makes previously-stored secrets undecryptable.

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length < 16) {
    throw new Error('ENCRYPTION_KEY is not set (or too short). Set a strong ENCRYPTION_KEY to store connection secrets.');
  }
  return crypto.createHash('sha256').update(raw, 'utf8').digest(); // 32 bytes
}

export function encryptSecret(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12); // 96-bit nonce for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

export function decryptSecret(blob: string): string {
  const parts = String(blob).split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Malformed encrypted secret');
  }
  const key = getKey();
  const iv = Buffer.from(parts[1], 'base64');
  const tag = Buffer.from(parts[2], 'base64');
  const ct = Buffer.from(parts[3], 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}

/** True when an ENCRYPTION_KEY is configured (used to surface a clear setup error). */
export function hasEncryptionKey(): boolean {
  const raw = process.env.ENCRYPTION_KEY;
  return !!raw && raw.length >= 16;
}
