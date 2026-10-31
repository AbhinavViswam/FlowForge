import crypto from 'crypto';

// Encryption for user secrets stored at rest: saved email passwords, and the
// database / Redis connection strings typed into workflow steps.
//
// Format: "v1:<ivBase64>:<authTagBase64>:<ciphertextBase64>", AES-256-GCM.
// The key is derived from ENCRYPTION_KEY with SHA-256, so any long random string
// works. Changing ENCRYPTION_KEY makes previously stored secrets unreadable.

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw || raw.length < 16) {
    throw new Error('ENCRYPTION_KEY is not set (or too short). Set a strong ENCRYPTION_KEY to store secrets.');
  }
  return crypto.createHash('sha256').update(raw, 'utf8').digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${ct.toString('base64')}`;
}

export function decryptSecret(blob: string): string {
  const parts = String(blob).split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('Malformed encrypted secret');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(parts[1], 'base64'));
  decipher.setAuthTag(Buffer.from(parts[2], 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64')), decipher.final()]).toString('utf8');
}

export function hasEncryptionKey(): boolean {
  const raw = process.env.ENCRYPTION_KEY;
  return !!raw && raw.length >= 16;
}

// ---------------------------------------------------------------------------
// Secret fields inside workflow definitions
//
// In the database:   pgUri: "enc:v1:...",  pgUriHint: "db.example.com:5432/app"
// Sent to the browser: pgUri: "",          pgUriSaved: true, pgUriHint: "..."
// From the browser:  a non-empty value is a new secret; an empty value with
//                    pgUriSaved: true means "keep the one already saved".
// ---------------------------------------------------------------------------

export const SECRET_FIELDS = ['pgUri', 'redisUri'] as const;
const SEALED_PREFIX = 'enc:';

export const isSealed = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith(SEALED_PREFIX);

const seal = (plaintext: string) => SEALED_PREFIX + encryptSecret(plaintext);

/** Decrypt a sealed value; plain (older, unencrypted) values are returned as they are. */
export function openSecret(value: unknown): string {
  if (!isSealed(value)) return typeof value === 'string' ? value : '';
  return decryptSecret(value.slice(SEALED_PREFIX.length));
}

// Where a connection string points, without the password: shown in the editor
// so people can tell which database a step uses.
function hintFor(uri: string): string {
  try {
    const u = new URL(uri);
    const port = u.port ? `:${u.port}` : '';
    const path = u.pathname && u.pathname !== '/' ? u.pathname : '';
    return `${u.hostname}${port}${path}`;
  } catch {
    return '';
  }
}

const configOf = (node: any) => node?.config ?? node?.data ?? {};

function mapConfigs(definition: any, fn: (config: any, nodeId: string) => any): any {
  if (!definition || !Array.isArray(definition.nodes)) return definition;
  return {
    ...definition,
    nodes: definition.nodes.map((node: any) => {
      const key = node?.config !== undefined ? 'config' : node?.data !== undefined ? 'data' : 'config';
      return { ...node, [key]: fn({ ...configOf(node) }, node?.id) };
    }),
  };
}

/**
 * Prepare a definition from the browser for storage: encrypt new secrets, and for
 * fields left empty but marked as saved, keep the encrypted value from the
 * previously stored version of the same step.
 */
export function sealDefinition(incoming: any, previous?: any): any {
  const previousConfigs = new Map<string, any>();
  for (const node of previous?.nodes || []) previousConfigs.set(node?.id, configOf(node));

  return mapConfigs(incoming, (config, nodeId) => {
    for (const field of SECRET_FIELDS) {
      const value = typeof config[field] === 'string' ? config[field].trim() : '';
      const savedFlag = `${field}Saved`;
      const hintKey = `${field}Hint`;
      const old = previousConfigs.get(nodeId)?.[field];

      if (value && !isSealed(value)) {
        config[field] = seal(value);
        config[hintKey] = hintFor(value);
      } else if (config[savedFlag] && old) {
        // Older versions may hold the value unencrypted; encrypt it now.
        config[field] = isSealed(old) ? old : seal(String(old));
        config[hintKey] = previousConfigs.get(nodeId)?.[hintKey] || hintFor(openSecret(old));
      } else {
        // Nothing to keep. A sealed value sent by the browser is never trusted,
        // since only the server produces those.
        delete config[field];
        delete config[hintKey];
      }
      delete config[savedFlag];
    }
    return config;
  });
}

/** Replace secrets with "saved" markers before a definition is sent to the browser. */
export function maskDefinition(definition: any): any {
  return mapConfigs(definition, (config) => {
    for (const field of SECRET_FIELDS) {
      if (!config[field]) continue;
      if (!config[`${field}Hint`]) config[`${field}Hint`] = hintFor(isSealed(config[field]) ? '' : config[field]);
      config[field] = '';
      config[`${field}Saved`] = true;
    }
    return config;
  });
}

/** Decrypt every secret field, for running a workflow. */
export function openDefinition(definition: any): any {
  return mapConfigs(definition, (config) => {
    for (const field of SECRET_FIELDS) {
      if (isSealed(config[field])) {
        try {
          config[field] = openSecret(config[field]);
        } catch {
          // Leave it unusable rather than crash the run; the step reports it.
          config[field] = '';
          config[`${field}Error`] = 'This saved connection string could not be decrypted (was ENCRYPTION_KEY changed?). Enter it again.';
        }
      }
    }
    return config;
  });
}
