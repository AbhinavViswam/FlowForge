// Encryption for secrets stored at rest. One implementation, shared with the
// workflow engine (see packages/workflow-engine/src/secrets.ts).
export { encryptSecret, decryptSecret, hasEncryptionKey } from '@flowforge/workflow-engine';
