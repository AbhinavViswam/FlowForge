import fp from 'fastify-plugin'
import fastifyJwt from '@fastify/jwt'
import fastifyCookie from '@fastify/cookie'
import { FastifyRequest, FastifyReply } from 'fastify'

export default fp(async (fastify, opts) => {
  fastify.register(fastifyCookie)

  fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'supersecret_change_in_production',
    cookie: {
      cookieName: 'token',
      signed: false
    }
  })

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify()
    } catch (err) {
      reply.send(err)
    }
  })
})

declare module 'fastify' {
  export interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

