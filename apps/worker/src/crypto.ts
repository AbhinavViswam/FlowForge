import crypto from 'crypto';

// Mirror of apps/api/src/crypto.ts — the worker must decrypt connection secrets
// with the exact same algorithm and ENCRYPTION_KEY to use them when sending email.
// Format: "v1:<ivBase64>:<authTagBase64>:<ciphertextBase64>", AES-256-GCM.

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length < 16) {
    throw new Error('ENCRYPTION_KEY is not set (or too short) in the worker. It must match the API.');
  }
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
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
