import { describe, it, expect, afterEach } from 'vitest'
import { checkSecretsAtStartup, findSecretProblems } from '@flowforge/shared'
import { isAllowedOrigin, cookieOptions, isPublicWebhookPath } from '../origins'

// Production settings: required secrets, which websites may call the API, and
// login cookie flags.

const STRONG = 'a'.repeat(16) + 'f00dfeedc0ffee11' + 'b'.repeat(8)
const good = {
  JWT_SECRET: STRONG,
  ENCRYPTION_KEY: STRONG.split('').reverse().join(''),
  DATABASE_URL: 'postgresql://flowforge:9f8e7d6c5b4a@db:5432/flowforge',
}

const ENV_KEYS = ['NODE_ENV', 'CORS_ORIGINS', 'COOKIE_SAMESITE']
const before = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]))
afterEach(() => {
  for (const k of ENV_KEYS) { if (before[k] === undefined) delete process.env[k]; else process.env[k] = before[k] }
})

describe('startup secret check', () => {
  it('passes with strong values', () => {
    expect(findSecretProblems('api', good)).toEqual([])
    expect(checkSecretsAtStartup('api', good, true)).toEqual({ fatal: false, message: null })
  })

  it.each([
    ['missing JWT_SECRET', { JWT_SECRET: undefined }, /JWT_SECRET is not set/],
    ['short ENCRYPTION_KEY', { ENCRYPTION_KEY: 'short' }, /ENCRYPTION_KEY is too short/],
    ['placeholder secret', { JWT_SECRET: 'change-me-in-production-please-123456' }, /placeholder/],
    ['default database password', { DATABASE_URL: 'postgresql://flowforge:password@db:5432/flowforge' }, /default or empty database password/],
  ])('refuses to start in production with a %s', (_label, override, message) => {
    const result = checkSecretsAtStartup('api', { ...good, ...override }, true)
    expect(result.fatal).toBe(true)
    expect(result.message).toMatch(message)
  })

  it('only warns in development', () => {
    const result = checkSecretsAtStartup('api', { ...good, JWT_SECRET: undefined }, false)
    expect(result.fatal).toBe(false)
    expect(result.message).toMatch(/development only/)
  })

  it("doesn't require JWT_SECRET for the worker", () => {
    expect(findSecretProblems('worker', { ...good, JWT_SECRET: undefined })).toEqual([])
  })
})

describe('allowed websites (CORS)', () => {
  it('in production allows only CORS_ORIGINS', () => {
    process.env.NODE_ENV = 'production'
    process.env.CORS_ORIGINS = 'https://app.example.com, https://example.com/'
    expect(isAllowedOrigin('https://app.example.com')).toBe(true)
    expect(isAllowedOrigin('https://EXAMPLE.com')).toBe(true)
    expect(isAllowedOrigin('http://localhost:5173')).toBe(false)
    expect(isAllowedOrigin('https://evil.example.net')).toBe(false)
    expect(isAllowedOrigin('null')).toBe(false)
  })

  it('in development also allows localhost', () => {
    process.env.NODE_ENV = 'development'
    delete process.env.CORS_ORIGINS
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true)
    expect(isAllowedOrigin('https://evil.example.net')).toBe(false)
  })

  it('recognises public webhook URLs', () => {
    expect(isPublicWebhookPath('/api/v1/wh/abc')).toBe(true)
    expect(isPublicWebhookPath('/webhooks/abc')).toBe(true)
    expect(isPublicWebhookPath('/api/v1/auth/login')).toBe(false)
  })
})

describe('login cookie', () => {
  it('is HttpOnly + Secure + Lax in production', () => {
    process.env.NODE_ENV = 'production'
    delete process.env.COOKIE_SAMESITE
    expect(cookieOptions()).toEqual({ path: '/', httpOnly: true, secure: true, sameSite: 'lax' })
  })

  it('SameSite=None always needs Secure', () => {
    process.env.NODE_ENV = 'development'
    process.env.COOKIE_SAMESITE = 'none'
    expect(cookieOptions()).toMatchObject({ secure: true, sameSite: 'none' })
  })
})
