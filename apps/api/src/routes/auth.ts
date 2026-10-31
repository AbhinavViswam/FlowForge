import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { prisma } from '../db'
import crypto from 'crypto'
import {
  registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema,
} from '@flowforge/shared'
import { sendSystemEmail } from '../mailer'
import { cookieOptions } from '../origins'

const CODE_TTL_MS = 10 * 60 * 1000   // a code is valid for 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000 // at most one email per minute per address
const MAX_ATTEMPTS = 5               // wrong guesses allowed per code

// Sign-in protection: this many wrong passwords in a row locks the account for LOCK_MS.
export const MAX_FAILED_LOGINS = 5
export const LOCK_MS = 15 * 60 * 1000

// Per-IP limits on the auth endpoints, on top of the per-account limits above.
const perIp = (max: number, timeWindow: string) => ({ config: { rateLimit: { max, timeWindow } } })
const LOGIN_LIMIT = perIp(10, '1 minute')
const EMAIL_LIMIT = perIp(10, '15 minutes')  // endpoints that send an email
const CODE_LIMIT = perIp(20, '15 minutes')   // endpoints that check a code

const newCode = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, '0')
// Only a hash is stored. It's tied to the address and the purpose, so a sign-up
// code can't be used to reset a password and vice versa.
const hashCode = (purpose: 'signup' | 'reset', email: string, code: string) =>
  crypto.createHash('sha256')
    .update(`${purpose === 'signup' ? '' : 'reset:'}${email}:${code}:${process.env.JWT_SECRET || ''}`)
    .digest('hex')
const codeMatches = (storedHash: string, purpose: 'signup' | 'reset', email: string, code: string) => {
  const expected = Buffer.from(storedHash, 'hex')
  const given = Buffer.from(hashCode(purpose, email, code), 'hex')
  return expected.length === given.length && crypto.timingSafeEqual(expected, given)
}
const secondsLeft = (sentAt: Date) =>
  Math.max(1, Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - sentAt.getTime())) / 1000))
const minutesLeft = (until: Date) => Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60000))
const findUserByEmail = (email: string) =>
  prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })
const normalizeEmail = (value: unknown) => String(value || '').trim().toLowerCase()
const cleanCode = (value: unknown) => String(value || '').replace(/\D/g, '')
const wrongCodeMessage = (left: number) => left > 0
  ? `That code isn't right. ${left} attempt${left === 1 ? '' : 's'} left.`
  : 'Too many wrong attempts. Send a new code.'
const lockedMessage = (until: Date) => {
  const m = minutesLeft(until)
  return `Too many failed sign-in attempts. Try again in ${m} minute${m === 1 ? '' : 's'}, or reset your password.`
}

// Compared against when the email has no account, so a wrong email takes as long
// as a wrong password and response times don't reveal which accounts exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10)

function sendCodeEmail(email: string, code: string, purpose: 'signup' | 'reset') {
  const signup = purpose === 'signup'
  const heading = signup ? 'Confirm your email' : 'Reset your password'
  const intro = signup
    ? 'Enter this code in FlowForge to finish creating your account:'
    : 'Enter this code in FlowForge to choose a new password:'
  const ignore = signup
    ? "If you didn't try to create an account, you can ignore this email."
    : "If you didn't ask to reset your password, you can ignore this email. Your password won't change."
  return sendSystemEmail({
    to: email,
    subject: signup ? `${code} is your FlowForge confirmation code` : `${code} is your FlowForge password reset code`,
    text: `${intro} ${code}. It expires in 10 minutes. ${ignore}`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:420px">
      <h2 style="margin:0 0 8px">${heading}</h2>
      <p style="color:#555;margin:0 0 16px">${intro}</p>
      <div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:12px 16px;background:#f3f4f6;border-radius:8px;display:inline-block">${code}</div>
      <p style="color:#888;font-size:13px;margin:16px 0 0">It expires in 10 minutes. ${ignore}</p>
    </div>`,
  })
}

const EMAIL_FAILED = "We couldn't send the email. Please try again in a minute."

export default async function authRoutes(fastify: FastifyInstance) {
  const setSessionCookie = (reply: any, user: { id: string; email: string }) => {
    const token = fastify.jwt.sign({ id: user.id, email: user.email })
    reply.setCookie('token', token, { ...cookieOptions(), maxAge: 60 * 60 * 24 * 7 }) // 1 week
  }

  // Step 1 of sign-up: remember the details and email a 6-digit code. No account
  // exists until the code is confirmed in /verify-email.
  fastify.post('/register', EMAIL_LIMIT, async (request, reply) => {
    const data = registerSchema.parse(request.body)
    const email = normalizeEmail(data.email)

    if (await findUserByEmail(email)) {
      return reply.code(400).send({ error: 'An account with this email already exists. Sign in instead.' })
    }

    const pending = await prisma.pendingSignup.findUnique({ where: { email } })
    if (pending && Date.now() - pending.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
      // A code was just sent; don't send another, just move the user to the code step.
      return { pending: true, email, cooldownSeconds: secondsLeft(pending.lastSentAt) }
    }

    const passwordHash = await bcrypt.hash(data.password, 10)
    const code = newCode()
    const fields = { passwordHash, codeHash: hashCode('signup', email, code), expiresAt: new Date(Date.now() + CODE_TTL_MS) }
    await prisma.pendingSignup.upsert({
      where: { email },
      create: { email, ...fields },
      update: { ...fields, attempts: 0, lastSentAt: new Date() },
    })

    try {
      await sendCodeEmail(email, code, 'signup')
    } catch (err: any) {
      request.log.error({ err: err.message }, 'Failed to send verification email')
      return reply.code(502).send({ error: EMAIL_FAILED })
    }
    return { pending: true, email, cooldownSeconds: RESEND_COOLDOWN_MS / 1000 }
  })

  // Step 2 of sign-up: check the code, then create the account and sign in.
  fastify.post('/verify-email', CODE_LIMIT, async (request, reply) => {
    const body = (request.body as any) || {}
    const email = normalizeEmail(body.email)
    const code = cleanCode(body.code)
    if (!email || code.length !== 6) {
      return reply.code(400).send({ error: 'Enter the 6-digit code from the email.' })
    }

    const pending = await prisma.pendingSignup.findUnique({ where: { email } })
    if (!pending) {
      return reply.code(400).send({ error: 'No sign-up in progress for this email. Start again.' })
    }
    if (pending.expiresAt.getTime() < Date.now()) {
      return reply.code(400).send({ error: 'This code has expired. Send a new one.' })
    }
    if (pending.attempts >= MAX_ATTEMPTS) {
      return reply.code(429).send({ error: 'Too many wrong attempts. Send a new code.' })
    }

    if (!codeMatches(pending.codeHash, 'signup', email, code)) {
      const { attempts } = await prisma.pendingSignup.update({ where: { email }, data: { attempts: { increment: 1 } } })
      return reply.code(400).send({ error: wrongCodeMessage(MAX_ATTEMPTS - attempts) })
    }

    // Guard against an account created with this email in the meantime.
    if (await findUserByEmail(email)) {
      await prisma.pendingSignup.delete({ where: { email } })
      return reply.code(400).send({ error: 'An account with this email already exists. Sign in instead.' })
    }

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { email, passwordHash: pending.passwordHash } })
      await tx.pendingSignup.delete({ where: { email } })
      return created
    })

    setSessionCookie(reply, user)
    return { success: true }
  })

  // Send a fresh sign-up code (new code, attempts reset), at most once per cooldown.
  fastify.post('/resend-code', EMAIL_LIMIT, async (request, reply) => {
    const email = normalizeEmail((request.body as any)?.email)
    const pending = email ? await prisma.pendingSignup.findUnique({ where: { email } }) : null
    if (!pending) {
      return reply.code(400).send({ error: 'No sign-up in progress for this email. Start again.' })
    }
    if (Date.now() - pending.lastSentAt.getTime() < RESEND_COOLDOWN_MS) {
      const wait = secondsLeft(pending.lastSentAt)
      return reply.code(429).send({ error: `Please wait ${wait}s before requesting another code.`, cooldownSeconds: wait })
    }

    const code = newCode()
    await prisma.pendingSignup.update({
      where: { email },
      data: { codeHash: hashCode('signup', email, code), expiresAt: new Date(Date.now() + CODE_TTL_MS), attempts: 0, lastSentAt: new Date() },
    })
    try {
      await sendCodeEmail(email, code, 'signup')
    } catch (err: any) {
      request.log.error({ err: err.message }, 'Failed to resend verification email')
      return reply.code(502).send({ error: EMAIL_FAILED })
    }
    return { success: true, cooldownSeconds: RESEND_COOLDOWN_MS / 1000 }
  })

  fastify.post('/login', LOGIN_LIMIT, async (request, reply) => {
    const data = loginSchema.parse(request.body)

    // Case-insensitive so "You@Gmail.com" and "you@gmail.com" are the same account.
    const user = await findUserByEmail(data.email.trim())
    if (!user) {
      await bcrypt.compare(data.password, DUMMY_HASH)
      return reply.code(401).send({ error: 'Invalid credentials' })
    }

    // While locked, even the right password is refused.
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      return reply.code(429).send({ error: lockedMessage(user.lockedUntil) })
    }

    const isValid = await bcrypt.compare(data.password, user.passwordHash)
    if (!isValid) {
      // Atomic increment so parallel guesses can't slip past the limit.
      const { failedLogins } = await prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: { increment: 1 } },
        select: { failedLogins: true },
      })
      if (failedLogins >= MAX_FAILED_LOGINS) {
        const lockedUntil = new Date(Date.now() + LOCK_MS)
        await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil } })
        request.log.warn({ userId: user.id }, 'Account locked after repeated failed sign-ins')
        return reply.code(429).send({ error: lockedMessage(lockedUntil) })
      }
      return reply.code(401).send({ error: 'Invalid credentials' })
    }

    if (user.failedLogins !== 0 || user.lockedUntil) {
      await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } })
    }
    setSessionCookie(reply, user)
    return { success: true }
  })

  // Forgot password, step 1: email a 6-digit code. The answer is the same whether
  // or not an account exists, so this can't be used to find out who has one.
  fastify.post('/forgot-password', EMAIL_LIMIT, async (request, reply) => {
    const email = normalizeEmail(forgotPasswordSchema.parse(request.body).email)
    const answer = { sent: true, email, cooldownSeconds: RESEND_COOLDOWN_MS / 1000 }

    const user = await findUserByEmail(email)
    if (!user) return answer

    const existing = await prisma.passwordReset.findUnique({ where: { email } })
    if (existing && Date.now() - existing.lastSentAt.getTime() < RESEND_COOLDOWN_MS) return answer

    const code = newCode()
    const fields = { codeHash: hashCode('reset', email, code), expiresAt: new Date(Date.now() + CODE_TTL_MS), attempts: 0, lastSentAt: new Date() }
    await prisma.passwordReset.upsert({ where: { email }, create: { email, ...fields }, update: fields })

    try {
      await sendCodeEmail(email, code, 'reset')
    } catch (err: any) {
      request.log.error({ err: err.message }, 'Failed to send password reset email')
      return reply.code(502).send({ error: EMAIL_FAILED })
    }
    return answer
  })

  // Forgot password, step 2: check the code, set the new password, sign out every
  // other session, and sign in here.
  fastify.post('/reset-password', CODE_LIMIT, async (request, reply) => {
    const data = resetPasswordSchema.parse(request.body)
    const email = normalizeEmail(data.email)
    const code = cleanCode(data.code)
    if (code.length !== 6) return reply.code(400).send({ error: 'Enter the 6-digit code from the email.' })

    const reset = await prisma.passwordReset.findUnique({ where: { email } })
    if (!reset) return reply.code(400).send({ error: 'No password reset in progress for this email. Start again.' })
    if (reset.expiresAt.getTime() < Date.now()) return reply.code(400).send({ error: 'This code has expired. Send a new one.' })
    if (reset.attempts >= MAX_ATTEMPTS) return reply.code(429).send({ error: 'Too many wrong attempts. Send a new code.' })

    if (!codeMatches(reset.codeHash, 'reset', email, code)) {
      const { attempts } = await prisma.passwordReset.update({ where: { email }, data: { attempts: { increment: 1 } } })
      return reply.code(400).send({ error: wrongCodeMessage(MAX_ATTEMPTS - attempts) })
    }

    const user = await findUserByEmail(email)
    if (!user) {
      await prisma.passwordReset.delete({ where: { email } })
      return reply.code(400).send({ error: 'No account found for this email.' })
    }

    const passwordHash = await bcrypt.hash(data.password, 10)
    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id: user.id },
        // Also clears a sign-in lock: proving you own the email is enough.
        data: { passwordHash, passwordChangedAt: new Date(), failedLogins: 0, lockedUntil: null },
      })
      await tx.passwordReset.delete({ where: { email } })
      return u
    })

    setSessionCookie(reply, updated)
    return { success: true }
  })

  fastify.post('/logout', async (request, reply) => {
    // Must match the options the cookie was set with, or browsers keep it.
    reply.clearCookie('token', cookieOptions())
    return { success: true }
  })

  fastify.get('/me', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
    if (!dbUser) return reply.code(404).send({ error: 'User not found' })

    return { user: { id: dbUser.id, email: dbUser.email, name: dbUser.name, dob: dbUser.dob } }
  })

  fastify.put('/me', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any;
    const body = request.body as any;
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: body.name !== undefined ? body.name : undefined,
        dob: body.dob ? new Date(body.dob) : null,
      }
    });
    return { success: true, user: { id: updated.id, email: updated.email, name: updated.name, dob: updated.dob } };
  });

  fastify.put('/password', { preValidation: [fastify.authenticate], ...LOGIN_LIMIT }, async (request, reply) => {
    const user = request.user as any;
    const body = changePasswordSchema.parse(request.body);
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser) return reply.code(404).send({ error: 'User not found' });

    const isValid = await bcrypt.compare(body.currentPassword, dbUser.passwordHash);
    if (!isValid) {
      return reply.code(401).send({ error: 'Current password is incorrect' });
    }

    const passwordHash = await bcrypt.hash(body.newPassword, 10);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordChangedAt: new Date() }
    });

    // Other devices are signed out (their sessions predate the change); keep this one.
    setSessionCookie(reply, updated)
    return { success: true };
  });

}
