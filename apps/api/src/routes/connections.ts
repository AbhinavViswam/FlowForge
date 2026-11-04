import { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { encryptSecret, hasEncryptionKey } from '../crypto'
import { assertPublicHost, checkBrevoKey, parseAddress } from '@flowforge/workflow-engine'

const EMAIL = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/
const isBrevo = (type: unknown) => String(type || '').toLowerCase() === 'brevo'

// The SMTP host is user-supplied, so it must be a public mail server.
async function checkHost(host: string): Promise<string | null> {
  try {
    await assertPublicHost(host)
    return null
  } catch (err: any) {
    return err.message
  }
}

// Per-user email connections: an SMTP login (Gmail App Password or any SMTP
// server) or a Brevo API key (HTTPS, for hosts that block SMTP). Secrets (app passwords) are encrypted at rest
// and NEVER returned to the client — list/get expose only non-secret metadata.

type ConnMeta = {
  host: string
  port: number
  secure: boolean
  username: string
  fromAddress: string
}

function normalizeMeta(body: any): ConnMeta {
  const username = String(body.username || '').trim()
  // Default to Gmail when no host given; otherwise respect the custom host.
  const host = String(body.host || '').trim() || 'smtp.gmail.com'
  const port = parseInt(body.port, 10) || (String(body.secure) === 'true' || body.secure === true ? 465 : 587)
  const secure = body.secure !== undefined ? (body.secure === true || String(body.secure) === 'true') : port === 465
  const fromAddress = String(body.fromAddress || '').trim() || username
  return { host, port, secure, username, fromAddress }
}

// Shape returned to the client (no secret).
function publicView(c: any) {
  const meta = (c.meta || {}) as Partial<ConnMeta>
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    host: meta.host,
    port: meta.port,
    secure: meta.secure,
    username: meta.username,
    fromAddress: meta.fromAddress,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }
}

export default async function connectionRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', fastify.authenticate)

  // List the current user's connections (metadata only).
  fastify.get('/', async (request) => {
    const user = request.user as any
    const connections = await prisma.connection.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    })
    return { connections: connections.map(publicView) }
  })

  // Create a new connection.
  fastify.post('/', async (request, reply) => {
    const user = request.user as any
    const body = (request.body as any) || {}

    if (!hasEncryptionKey()) {
      return reply.code(500).send({ error: 'Server ENCRYPTION_KEY is not configured — cannot store secrets securely.' })
    }
    const name = String(body.name || '').trim()
    const password = String(body.password || '')
    if (!name) return reply.code(400).send({ error: 'A connection name is required.' })

    if (isBrevo(body.type)) {
      const fromAddress = String(body.fromAddress || '').trim()
      if (!password) return reply.code(400).send({ error: 'The Brevo API key is required.' })
      if (!EMAIL.test(parseAddress(fromAddress).email)) {
        return reply.code(400).send({ error: 'Enter the sender address verified in your Brevo account.' })
      }
      const check = await checkBrevoKey(password.trim())
      if (!check.ok) return reply.code(400).send({ error: check.message })
      const created = await prisma.connection.create({
        data: { userId: user.id, name, type: 'brevo', meta: { fromAddress } as any, secret: encryptSecret(password.trim()) },
      })
      return reply.code(201).send({ connection: publicView(created) })
    }

    const meta = normalizeMeta(body)
    if (!meta.username) return reply.code(400).send({ error: 'The account email / SMTP username is required.' })
    if (!password) return reply.code(400).send({ error: 'The app password / SMTP password is required.' })
    const hostError = await checkHost(meta.host)
    if (hostError) return reply.code(400).send({ error: hostError })

    const created = await prisma.connection.create({
      data: {
        userId: user.id,
        name,
        type: 'smtp',
        meta: meta as any,
        secret: encryptSecret(password.replace(/\s+/g, '')), // strip spaces from app passwords
      },
    })
    return reply.code(201).send({ connection: publicView(created) })
  })

  // Update a connection. Password is only re-encrypted when a new one is provided.
  fastify.put('/:id', async (request, reply) => {
    const user = request.user as any
    const { id } = request.params as { id: string }
    const body = (request.body as any) || {}

    const existing = await prisma.connection.findFirst({ where: { id, userId: user.id } })
    if (!existing) return reply.code(404).send({ error: 'Connection not found.' })

    let meta: any
    if (isBrevo(existing.type)) {
      const fromAddress = String(body.fromAddress ?? (existing.meta as any)?.fromAddress ?? '').trim()
      if (!EMAIL.test(parseAddress(fromAddress).email)) {
        return reply.code(400).send({ error: 'Enter the sender address verified in your Brevo account.' })
      }
      if (body.password) {
        const check = await checkBrevoKey(String(body.password).trim())
        if (!check.ok) return reply.code(400).send({ error: check.message })
      }
      meta = { fromAddress }
    } else {
      meta = normalizeMeta({ ...(existing.meta as any), ...body })
      const hostError = await checkHost(meta.host)
      if (hostError) return reply.code(400).send({ error: hostError })
    }
    const data: any = {
      name: String(body.name || existing.name).trim(),
      meta: meta as any,
    }
    if (body.password) {
      if (!hasEncryptionKey()) {
        return reply.code(500).send({ error: 'Server ENCRYPTION_KEY is not configured — cannot store secrets securely.' })
      }
      data.secret = encryptSecret(String(body.password).replace(/\s+/g, ''))
    }

    const updated = await prisma.connection.update({ where: { id }, data })
    return { connection: publicView(updated) }
  })

  // Delete a connection.
  fastify.delete('/:id', async (request, reply) => {
    const user = request.user as any
    const { id } = request.params as { id: string }
    const existing = await prisma.connection.findFirst({ where: { id, userId: user.id } })
    if (!existing) return reply.code(404).send({ error: 'Connection not found.' })
    await prisma.connection.delete({ where: { id } })
    return { deleted: true }
  })
}
