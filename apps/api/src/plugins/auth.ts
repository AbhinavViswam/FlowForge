import fp from 'fastify-plugin'
import fastifyJwt from '@fastify/jwt'
import fastifyCookie from '@fastify/cookie'
import { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../db'

/**
 * True when a session token was issued before the account's password last
 * changed. Those sessions are signed out, so a reset locks out anyone who had
 * the old password. (Token times are in whole seconds.)
 */
export function issuedBeforePasswordChange(issuedAtSeconds: unknown, passwordChangedAt: Date | null): boolean {
  if (!passwordChangedAt) return false
  if (typeof issuedAtSeconds !== 'number') return true
  return issuedAtSeconds < Math.floor(passwordChangedAt.getTime() / 1000)
}

export default fp(async (fastify, opts) => {
  fastify.register(fastifyCookie)

  fastify.register(fastifyJwt, {
    // Production refuses to start without a real JWT_SECRET (checkSecretsAtStartup);
    // the fallback only exists so local development works out of the box.
    secret: process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? '' : 'dev-only-insecure-jwt-secret'),
    cookie: {
      cookieName: 'token',
      signed: false
    }
  })

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      return reply.send(err)
    }
    const { id, iat } = request.user as any
    const account = await prisma.user.findUnique({ where: { id }, select: { passwordChangedAt: true } })
    if (!account || issuedBeforePasswordChange(iat, account.passwordChangedAt)) {
      return reply.code(401).send({ error: 'Your session has ended. Please sign in again.' })
    }
  })
})

declare module 'fastify' {
  export interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}
