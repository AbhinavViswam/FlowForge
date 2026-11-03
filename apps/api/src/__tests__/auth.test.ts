import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import rateLimit from '@fastify/rate-limit'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'

// The real auth routes, run against an in-memory stand-in for the database and
// a mailer that records emails instead of sending them.

type Row = Record<string, any>

function makeTable(defaults: () => Row) {
  const rows: Row[] = []
  const matches = (row: Row, where: Row) => Object.entries(where).every(([k, v]) => {
    if (v && typeof v === 'object' && 'equals' in v) {
      return v.mode === 'insensitive'
        ? String(row[k]).toLowerCase() === String(v.equals).toLowerCase()
        : row[k] === v.equals
    }
    return row[k] === v
  })
  const find = (where: Row) => rows.find((r) => matches(r, where))
  const apply = (row: Row, data: Row) => {
    for (const [k, v] of Object.entries(data)) {
      row[k] = v && typeof v === 'object' && 'increment' in v ? (row[k] || 0) + v.increment : v
    }
  }
  return {
    rows,
    findUnique: async ({ where }: any) => (find(where) ? structuredClone(find(where)) : null),
    findFirst: async ({ where }: any) => (find(where) ? structuredClone(find(where)) : null),
    create: async ({ data }: any) => { const row = { ...defaults(), ...data }; rows.push(row); return structuredClone(row) },
    upsert: async ({ where, create, update }: any) => {
      const row = find(where)
      if (row) { apply(row, update); return structuredClone(row) }
      const created = { ...defaults(), ...create }
      rows.push(created)
      return structuredClone(created)
    },
    update: async ({ where, data }: any) => {
      const row = find(where)
      if (!row) throw new Error('Record not found')
      apply(row, data)
      return structuredClone(row)
    },
    delete: async ({ where }: any) => {
      const i = rows.findIndex((r) => matches(r, where))
      if (i < 0) throw new Error('Record not found')
      return rows.splice(i, 1)[0]
    },
  }
}

const now = () => new Date()
const fakePrisma: any = {}
function resetDatabase() {
  fakePrisma.user = makeTable(() => ({ id: randomUUID(), failedLogins: 0, lockedUntil: null, passwordChangedAt: null, createdAt: now() }))
  fakePrisma.pendingSignup = makeTable(() => ({ id: randomUUID(), attempts: 0, lastSentAt: now(), createdAt: now() }))
  fakePrisma.passwordReset = makeTable(() => ({ id: randomUUID(), attempts: 0, lastSentAt: now(), createdAt: now() }))
  fakePrisma.$transaction = async (fn: any) => fn(fakePrisma)
}
resetDatabase()

const sentEmails: Array<{ to: string; subject: string; text: string }> = []
vi.mock('../db', () => ({ prisma: fakePrisma }))
vi.mock('../mailer', () => ({
  sendSystemEmail: vi.fn(async (mail: any) => { sentEmails.push(mail); return { delivered: true, provider: 'log' } }),
}))

const { default: authRoutes, MAX_FAILED_LOGINS } = await import('../routes/auth')
const { default: authPlugin, issuedBeforePasswordChange } = await import('../plugins/auth')
const { registerErrorHandler, rateLimitResponse } = await import('../errors')

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify()
  await app.register(rateLimit, { max: 1000, timeWindow: '1 minute', errorResponseBuilder: rateLimitResponse })
  registerErrorHandler(app)
  await app.register(authPlugin)
  await app.register(authRoutes, { prefix: '/auth' })
  await app.ready()
  return app
}

const EMAIL = 'person@example.com'
const PASSWORD = 'correct-horse-battery'

async function addUser(email = EMAIL, password = PASSWORD) {
  return fakePrisma.user.create({ data: { email, passwordHash: await bcrypt.hash(password, 4) } })
}
const post = (app: FastifyInstance, url: string, payload: any, cookie?: string) =>
  app.inject({ method: 'POST', url, payload, headers: cookie ? { cookie } : {} })
const sessionCookie = (res: any) => String(res.headers['set-cookie'] || '').split(';')[0]
const lastCode = () => sentEmails[sentEmails.length - 1]?.text.match(/\b(\d{6})\b/)?.[1] || ''
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

beforeEach(() => {
  resetDatabase()
  sentEmails.length = 0
})

describe('sign-in', () => {
  it('signs in with the right password, case-insensitive email', async () => {
    const app = await buildApp()
    await addUser()
    const res = await post(app, '/auth/login', { email: 'Person@Example.com', password: PASSWORD })
    expect(res.statusCode).toBe(200)
    expect(String(res.headers['set-cookie'])).toMatch(/token=.+HttpOnly/i)
  })

  it('gives the same answer for an unknown email and a wrong password', async () => {
    const app = await buildApp()
    await addUser()
    const unknown = await post(app, '/auth/login', { email: 'nobody@example.com', password: PASSWORD })
    const wrong = await post(app, '/auth/login', { email: EMAIL, password: 'wrong-password' })
    expect(unknown.statusCode).toBe(401)
    expect(wrong.statusCode).toBe(401)
    expect(unknown.json()).toEqual(wrong.json())
  })

  it(`locks the account after ${MAX_FAILED_LOGINS} wrong passwords, even for the right one`, async () => {
    const app = await buildApp()
    await addUser()
    for (let i = 1; i < MAX_FAILED_LOGINS; i++) {
      expect((await post(app, '/auth/login', { email: EMAIL, password: 'nope-nope' })).statusCode).toBe(401)
    }
    const locking = await post(app, '/auth/login', { email: EMAIL, password: 'nope-nope' })
    expect(locking.statusCode).toBe(429)
    expect(locking.json().error).toMatch(/Too many failed sign-in attempts/)

    const rightButLocked = await post(app, '/auth/login', { email: EMAIL, password: PASSWORD })
    expect(rightButLocked.statusCode).toBe(429)

    // Once the lock has expired, the right password works and the counter resets.
    fakePrisma.user.rows[0].lockedUntil = new Date(Date.now() - 1000)
    expect((await post(app, '/auth/login', { email: EMAIL, password: PASSWORD })).statusCode).toBe(200)
    expect(fakePrisma.user.rows[0].failedLogins).toBe(0)
    expect(fakePrisma.user.rows[0].lockedUntil).toBeNull()
  })

  it('a successful sign-in clears earlier failures', async () => {
    const app = await buildApp()
    await addUser()
    for (let i = 0; i < MAX_FAILED_LOGINS - 1; i++) await post(app, '/auth/login', { email: EMAIL, password: 'nope-nope' })
    await post(app, '/auth/login', { email: EMAIL, password: PASSWORD })
    expect(fakePrisma.user.rows[0].failedLogins).toBe(0)
  })

  it('limits sign-in attempts per IP address', async () => {
    const app = await buildApp()
    const codes: number[] = []
    for (let i = 0; i < 11; i++) {
      codes.push((await post(app, '/auth/login', { email: `x${i}@example.com`, password: 'whatever1' })).statusCode)
    }
    expect(codes.slice(0, 10).every((c) => c === 401)).toBe(true)
    expect(codes[10]).toBe(429)
  })

  it('turns invalid input into a readable 400, not a server error', async () => {
    const app = await buildApp()
    const res = await post(app, '/auth/forgot-password', { email: 'not-an-email' })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('Enter a valid email address')
  })
})

describe('forgot password', () => {
  it("doesn't reveal whether an account exists", async () => {
    const app = await buildApp()
    await addUser()
    const known = await post(app, '/auth/forgot-password', { email: EMAIL })
    const unknown = await post(app, '/auth/forgot-password', { email: 'nobody@example.com' })
    expect(known.statusCode).toBe(200)
    expect(unknown.statusCode).toBe(200)
    expect(Object.keys(known.json()).sort()).toEqual(Object.keys(unknown.json()).sort())
    expect(sentEmails.map((m) => m.to)).toEqual([EMAIL]) // only the real account gets an email
  })

  it('sends at most one email per minute', async () => {
    const app = await buildApp()
    await addUser()
    await post(app, '/auth/forgot-password', { email: EMAIL })
    await post(app, '/auth/forgot-password', { email: EMAIL })
    expect(sentEmails).toHaveLength(1)
  })

  it('resets the password with the emailed code and signs out old sessions', async () => {
    const app = await buildApp()
    await addUser()
    // Lock the account first: a reset should also unlock it.
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) await post(app, '/auth/login', { email: EMAIL, password: 'nope-nope' })
    fakePrisma.user.rows[0].lockedUntil = new Date(Date.now() - 1000)
    const oldSession = sessionCookie(await post(app, '/auth/login', { email: EMAIL, password: PASSWORD }))
    expect((await app.inject({ url: '/auth/me', headers: { cookie: oldSession } })).statusCode).toBe(200)
    fakePrisma.user.rows[0].lockedUntil = new Date(Date.now() + 60_000)
    await sleep(1100) // session times are in whole seconds

    await post(app, '/auth/forgot-password', { email: EMAIL })
    const code = lastCode()
    expect(code).toMatch(/^\d{6}$/)

    const wrong = await post(app, '/auth/reset-password', { email: EMAIL, code: code === '000000' ? '111111' : '000000', password: 'brand-new-password' })
    expect(wrong.statusCode).toBe(400)
    expect(wrong.json().error).toMatch(/4 attempts left/)

    const tooShort = await post(app, '/auth/reset-password', { email: EMAIL, code, password: 'short' })
    expect(tooShort.statusCode).toBe(400)
    expect(tooShort.json().error).toMatch(/at least 8 characters/)

    const done = await post(app, '/auth/reset-password', { email: EMAIL, code, password: 'brand-new-password' })
    expect(done.statusCode).toBe(200)
    const newSession = sessionCookie(done)

    expect((await app.inject({ url: '/auth/me', headers: { cookie: oldSession } })).statusCode).toBe(401)
    expect((await app.inject({ url: '/auth/me', headers: { cookie: newSession } })).statusCode).toBe(200)
    expect((await post(app, '/auth/login', { email: EMAIL, password: PASSWORD })).statusCode).toBe(401)
    expect((await post(app, '/auth/login', { email: EMAIL, password: 'brand-new-password' })).statusCode).toBe(200)

    // The code works only once.
    expect((await post(app, '/auth/reset-password', { email: EMAIL, code, password: 'another-password' })).statusCode).toBe(400)
  })

  it('stops accepting guesses after 5 wrong codes', async () => {
    const app = await buildApp()
    await addUser()
    await post(app, '/auth/forgot-password', { email: EMAIL })
    const code = lastCode()
    const wrongCode = code === '123456' ? '654321' : '123456'
    for (let i = 0; i < 5; i++) await post(app, '/auth/reset-password', { email: EMAIL, code: wrongCode, password: 'brand-new-password' })
    const res = await post(app, '/auth/reset-password', { email: EMAIL, code, password: 'brand-new-password' })
    expect(res.statusCode).toBe(429)
  })

  it('a sign-up code cannot be used as a reset code', async () => {
    const app = await buildApp()
    await post(app, '/auth/register', { email: 'new@example.com', password: 'a-good-password' })
    const signupCode = lastCode()
    await addUser('new@example.com') // pretend the account exists now
    await post(app, '/auth/forgot-password', { email: 'new@example.com' })
    if (lastCode() === signupCode) return // same 6 digits by chance (1 in a million)
    const res = await post(app, '/auth/reset-password', { email: 'new@example.com', code: signupCode, password: 'brand-new-password' })
    expect(res.statusCode).toBe(400)
  })
})

describe('change password', () => {
  it('keeps this session, signs out the others, and checks the length', async () => {
    const app = await buildApp()
    await addUser()
    const other = sessionCookie(await post(app, '/auth/login', { email: EMAIL, password: PASSWORD }))
    const mine = sessionCookie(await post(app, '/auth/login', { email: EMAIL, password: PASSWORD }))
    await sleep(1100)

    const short = await app.inject({ method: 'PUT', url: '/auth/password', headers: { cookie: mine }, payload: { currentPassword: PASSWORD, newPassword: 'short' } })
    expect(short.statusCode).toBe(400)

    const res = await app.inject({ method: 'PUT', url: '/auth/password', headers: { cookie: mine }, payload: { currentPassword: PASSWORD, newPassword: 'a-new-password' } })
    expect(res.statusCode).toBe(200)
    const refreshed = sessionCookie(res)
    expect((await app.inject({ url: '/auth/me', headers: { cookie: refreshed } })).statusCode).toBe(200)
    expect((await app.inject({ url: '/auth/me', headers: { cookie: other } })).statusCode).toBe(401)
  })
})

describe('issuedBeforePasswordChange', () => {
  it('compares in whole seconds', () => {
    const changed = new Date('2026-01-01T00:00:10.500Z')
    expect(issuedBeforePasswordChange(Date.parse('2026-01-01T00:00:09Z') / 1000, changed)).toBe(true)
    expect(issuedBeforePasswordChange(Date.parse('2026-01-01T00:00:10Z') / 1000, changed)).toBe(false)
    expect(issuedBeforePasswordChange(123, null)).toBe(false)
    expect(issuedBeforePasswordChange(undefined, changed)).toBe(true)
  })
})
