import { describe, it, expect, beforeEach } from 'vitest'
import {
  encryptSecret, decryptSecret, isSealed, sealDefinition, maskDefinition, openDefinition,
} from '@flowforge/workflow-engine'

// Saved connection strings (database / Redis) are encrypted at rest and never
// sent back to the browser.

const KEY = 'test-encryption-key-0123456789abcdef'
const PG = 'postgresql://app:s3cret@db.example.com:5432/shop?sslmode=require'

const def = (config: Record<string, any>, id = 'a1') => ({
  nodes: [{ id, type: 'action', config: { actionType: 'sink', ...config } }],
  edges: [],
})
const cfg = (d: any) => d.nodes[0].config

beforeEach(() => { process.env.ENCRYPTION_KEY = KEY })

describe('encryptSecret / decryptSecret', () => {
  it('round-trips and uses a fresh IV every time', () => {
    const a = encryptSecret('hello')
    expect(a).not.toBe(encryptSecret('hello'))
    expect(decryptSecret(a)).toBe('hello')
  })

  it('fails with a different key and on tampering', () => {
    const blob = encryptSecret('hello')
    process.env.ENCRYPTION_KEY = 'some-other-key-0123456789abcdefgh'
    expect(() => decryptSecret(blob)).toThrow()
    process.env.ENCRYPTION_KEY = KEY
    const parts = blob.split(':')
    parts[3] = Buffer.from('tampered').toString('base64')
    expect(() => decryptSecret(parts.join(':'))).toThrow()
  })
})

describe('workflow definition secrets', () => {
  it('encrypts a newly typed connection string and keeps a password-free hint', () => {
    const sealed = sealDefinition(def({ pgUri: PG }))
    expect(isSealed(cfg(sealed).pgUri)).toBe(true)
    expect(JSON.stringify(sealed)).not.toContain('s3cret')
    expect(cfg(sealed).pgUriHint).toBe('db.example.com:5432/shop')
  })

  it('never sends the secret to the browser', () => {
    const masked = maskDefinition(sealDefinition(def({ pgUri: PG })))
    expect(cfg(masked).pgUri).toBe('')
    expect(cfg(masked).pgUriSaved).toBe(true)
    expect(cfg(masked).pgUriHint).toBe('db.example.com:5432/shop')
    expect(JSON.stringify(masked)).not.toMatch(/s3cret|enc:/)
  })

  it('keeps the saved value when the browser sends it back blank + saved', () => {
    const stored = sealDefinition(def({ pgUri: PG }))
    const fromBrowser = maskDefinition(stored)
    const resaved = sealDefinition(fromBrowser, stored)
    expect(cfg(resaved).pgUri).toBe(cfg(stored).pgUri)
    expect(cfg(resaved).pgUriSaved).toBeUndefined()
    expect(cfg(openDefinition(resaved)).pgUri).toBe(PG)
  })

  it('replaces the saved value when a new one is typed', () => {
    const stored = sealDefinition(def({ pgUri: PG }))
    const NEW = 'postgresql://app:other@db2.example.com/shop'
    const resaved = sealDefinition(def({ pgUri: NEW, pgUriSaved: true }), stored)
    expect(cfg(openDefinition(resaved)).pgUri).toBe(NEW)
    expect(cfg(resaved).pgUriHint).toBe('db2.example.com/shop')
  })

  it('removes the value when the user clears it', () => {
    const stored = sealDefinition(def({ pgUri: PG }))
    const resaved = sealDefinition(def({ pgUri: '', pgUriSaved: false }), stored)
    expect(cfg(resaved).pgUri).toBeUndefined()
  })

  it("doesn't let a step borrow another step's saved secret", () => {
    const stored = sealDefinition(def({ pgUri: PG }, 'a1'))
    const resaved = sealDefinition(def({ pgUri: '', pgUriSaved: true }, 'other-step'), stored)
    expect(cfg(resaved).pgUri).toBeUndefined()
  })

  it('ignores encrypted values sent by the browser', () => {
    const stolen = cfg(sealDefinition(def({ pgUri: PG }))).pgUri
    // Only the server produces encrypted values, so one from the browser is dropped.
    const resaved = sealDefinition(def({ pgUri: stolen }))
    expect(cfg(resaved).pgUri).toBeUndefined()
  })

  it('encrypts older plain-text values on the next save', () => {
    const legacy = def({ pgUri: PG })
    const masked = maskDefinition(legacy)
    expect(cfg(masked).pgUri).toBe('')
    const resaved = sealDefinition(masked, legacy)
    expect(isSealed(cfg(resaved).pgUri)).toBe(true)
    expect(cfg(openDefinition(resaved)).pgUri).toBe(PG)
  })

  it('handles Redis trigger URIs the same way', () => {
    const d = { nodes: [{ id: 't1', type: 'trigger', config: { triggerType: 'redis', redisUri: 'redis://:pw@cache.example.com:6379' } }], edges: [] }
    const sealed = sealDefinition(d)
    expect(isSealed(cfg(sealed).redisUri)).toBe(true)
    expect(cfg(sealed).redisUriHint).toBe('cache.example.com:6379')
    expect(cfg(openDefinition(sealed)).redisUri).toBe('redis://:pw@cache.example.com:6379')
  })

  it('reports a clear error when a value can no longer be decrypted', () => {
    const sealed = sealDefinition(def({ pgUri: PG }))
    process.env.ENCRYPTION_KEY = 'a-completely-different-key-0123456'
    const opened = openDefinition(sealed)
    expect(cfg(opened).pgUri).toBe('')
    expect(cfg(opened).pgUriError).toMatch(/ENCRYPTION_KEY/)
  })
})
