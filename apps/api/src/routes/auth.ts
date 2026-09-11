import { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { prisma } from '../db'
import { registerSchema, loginSchema } from '@flowforge/shared'

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/register', async (request, reply) => {
    const data = registerSchema.parse(request.body)
    
    const existing = await prisma.user.findUnique({ where: { email: data.email } })
    if (existing) {
      return reply.code(400).send({ error: 'User already exists' })
    }

    const passwordHash = await bcrypt.hash(data.password, 10)
    
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash
      }
    })

    const token = fastify.jwt.sign({ id: user.id, email: user.email })
    
    reply.setCookie('token', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    })
    
    return { success: true }
  })

  fastify.post('/login', async (request, reply) => {
    const data = loginSchema.parse(request.body)

    const user = await prisma.user.findUnique({ where: { email: data.email } })
    if (!user) {
      return reply.code(401).send({ error: 'Invalid credentials' })
    }

    const isValid = await bcrypt.compare(data.password, user.passwordHash)
    if (!isValid) {
      return reply.code(401).send({ error: 'Invalid credentials' })
    }

    const token = fastify.jwt.sign({ id: user.id, email: user.email })
    
    reply.setCookie('token', token, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    })
    
    return { success: true }
  })

  fastify.post('/logout', async (request, reply) => {
    reply.clearCookie('token', { path: '/' })
    return { success: true }
  })

  fastify.get('/me', { preValidation: [fastify.authenticate] }, async (request, reply) => {
    const user = request.user as any
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } })
    if (!dbUser) return reply.code(404).send({ error: 'User not found' })
    
    return { 
      user: {
        id: dbUser.id,
        email: dbUser.email
      }
    }
  })
}

