import 'dotenv/config';

import { checkSecretsAtStartup } from '@flowforge/shared'

// Stop here in production if any secret is missing, short or a placeholder.
const secretCheck = checkSecretsAtStartup('api', process.env, process.env.NODE_ENV === 'production')
if (secretCheck.message) (secretCheck.fatal ? console.error : console.warn)(secretCheck.message)
if (secretCheck.fatal) process.exit(1)

import Fastify from 'fastify'
import cors from '@fastify/cors'
import authPlugin from './plugins/auth'
import authRoutes from './routes/auth'
import workflowRoutes from './routes/workflows'
import webhookRoutes from './routes/webhooks'
import connectionRoutes from './routes/connections'
import { initScheduler } from './scheduler'
import { initializeRedisConsumers } from './services/redis-consumer'
import { verifyMailConfig } from './mailer'
import { configuredOrigins, isAllowedOrigin, isPublicWebhookPath, isSameHostOrigin } from './origins'
import { startQueue, stopQueue } from './queue'
import { startRunner } from './jobs/run-execution'
import { onWorkflowEvent } from './events'
import { prisma } from './db'
import path from 'path'
import fs from 'fs'
import fastifyStatic from '@fastify/static'

import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { registerErrorHandler, rateLimitResponse } from './errors';

// Behind a load balancer or reverse proxy (Render, Nginx, Cloudflare...), set
// TRUST_PROXY so rate limits see each visitor's real IP instead of the proxy's.
// "true" trusts any proxy, a number trusts that many hops, or list proxy IPs.
function trustProxySetting(): boolean | string | ((address: string, hop: number) => boolean) {
  const raw = String(process.env.TRUST_PROXY || '').trim()
  if (!raw || /^(0|false|no)$/i.test(raw)) return false
  if (/^(true|yes)$/i.test(raw)) return true
  if (/^\d+$/.test(raw)) { const hops = Number(raw); return (_address, hop) => hop < hops }
  return raw
}

const fastify = Fastify({
  logger: true,
  trustProxy: trustProxySetting(),
})

// The built website (apps/web/dist) is served by this same server, so the site
// and the API share one address. Set SERVE_WEB=false to host the website elsewhere.
const WEB_DIST = path.resolve(process.env.WEB_DIST_DIR || path.join(__dirname, '../../web/dist'))
const serveWeb = !/^(0|false|no)$/i.test(String(process.env.SERVE_WEB || '')) && fs.existsSync(path.join(WEB_DIST, 'index.html'))

fastify.register(helmet, {
  global: true,
  // Webhook senders and the website may live on other origins.
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: {
    directives: {
      // Google Fonts (stylesheet + font files) and the live-updates connection.
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
      'connect-src': ["'self'", 'wss:', 'ws:'],
      'img-src': ["'self'", 'data:', 'blob:'],
      'worker-src': ["'self'", 'blob:'],
      // Hosts like Render already redirect to HTTPS; this would break plain-http local tests.
      'upgrade-insecure-requests': null,
    },
  },
});

fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  // Sign-in and sign-up routes set tighter limits of their own (routes/auth.ts).
  errorResponseBuilder: rateLimitResponse,
});

registerErrorHandler(fastify);

// Browser access rules (see origins.ts): the app's own websites (CORS_ORIGINS, plus
// localhost in development) get logged-in access; public webhook URLs accept
// posts from any website but never with the login cookie.
fastify.register(cors, {
  delegator: (req, cb) => {
    if (isPublicWebhookPath(req.url || '')) {
      return cb(null, { origin: '*', credentials: false, methods: ['GET', 'POST', 'OPTIONS'] })
    }
    cb(null, {
      origin: isAllowedOrigin(req.headers.origin),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    })
  },
})

// Cross-site request protection: CORS only stops other websites from *reading*
// responses. A plain HTML form on another site can still *send* a request, so
// refuse state-changing requests whose Origin isn't one of ours.
fastify.addHook('onRequest', async (request, reply) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return
  if (isPublicWebhookPath(request.url)) return
  const origin = request.headers.origin
  // The website served by this server is always allowed (same address).
  if (origin && !isAllowedOrigin(origin) && !isSameHostOrigin(origin, request.headers.host)) {
    return reply.code(403).send({ error: 'Requests from this website are not allowed.' })
  }
})

if (process.env.NODE_ENV === 'production' && !serveWeb && configuredOrigins().length === 0) {
  console.error('[CORS] CORS_ORIGINS is not set: the website will not be able to sign in or call the API.')
}

// Parse JSON but retain the exact raw bytes on request.rawBody, so webhook HMAC
// signatures are verified against what the sender actually signed (re-serializing
// the parsed body changes key order/whitespace and breaks real signatures).
fastify.addContentTypeParser(
  'application/json',
  { parseAs: 'string' },
  (req, body: string, done) => {
    ;(req as any).rawBody = body
    try {
      done(null, body && body.length ? JSON.parse(body) : {})
    } catch (err: any) {
      err.statusCode = 400
      done(err, undefined)
    }
  }
)

// Accept form-encoded webhooks (e.g. Twilio, some Slack events). We keep the raw
// bytes for signature checks and expose the fields as a plain object to the engine.
fastify.addContentTypeParser(
  'application/x-www-form-urlencoded',
  { parseAs: 'string' },
  (req, body: string, done) => {
    ;(req as any).rawBody = body
    try {
      const obj: Record<string, string> = {}
      for (const [k, v] of new URLSearchParams(body)) obj[k] = v
      done(null, obj)
    } catch (err: any) {
      err.statusCode = 400
      done(err, undefined)
    }
  }
)

fastify.register(authPlugin)

fastify.register(authRoutes, { prefix: '/api/v1/auth' })
fastify.register(workflowRoutes, { prefix: '/api/v1/workflows' })
fastify.register(connectionRoutes, { prefix: '/api/v1/connections' })
fastify.register(webhookRoutes, { prefix: '/webhooks' })
fastify.register(webhookRoutes, { prefix: '/api/v1/wh' })

// Health check for the hosting platform (and uptime pingers).
fastify.get('/api/health', async () => {
  await prisma.$queryRaw`SELECT 1`
  return { status: 'ok' }
})

if (serveWeb) {
  fastify.register(fastifyStatic, { root: WEB_DIST, wildcard: true, index: ['index.html'] })
  // Any other page address (e.g. /dashboard) is a website route: send the app.
  fastify.setNotFoundHandler((request, reply) => {
    const isPage = request.method === 'GET' && !/^\/(api|webhooks|socket\.io)(\/|$)/.test(request.url)
    if (isPage) return reply.type('text/html').sendFile('index.html')
    return reply.code(404).send({ error: 'Not found' })
  })
} else {
  fastify.get('/', async () => ({ status: 'FlowForge API is running' }))
}

const PORT = Number(process.env.PORT) || 3000

async function main() {
  // The job queue lives in Postgres; start it and the runner before taking traffic.
  await startQueue()
  await startRunner()
  initScheduler() // schedule triggers
  initializeRedisConsumers().catch((err) => console.error('[Redis] Consumer init failed', err)) // "Incoming event" triggers
  // Report (and test) the sign-up email sender at startup so a bad password shows up now.
  verifyMailConfig().then(({ ok, message }) => (ok ? console.log : console.error)(`[Mailer] ${message}`))

  await fastify.listen({ port: PORT, host: '0.0.0.0' })
  if (serveWeb) console.log(`[Web] Serving the website from ${WEB_DIST}`)

  const { Server } = require('socket.io')
  const io = new Server(fastify.server, {
    cors: {
      origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => cb(null, isAllowedOrigin(origin)),
      methods: ['GET', 'POST'],
      credentials: true,
    },
  })
  io.on('connection', (socket: any) => {
    socket.on('join_workflow', (workflowId: string) => socket.join(`workflow:${workflowId}`))
  })
  // Live run updates from the runner (same process) to the editors watching.
  onWorkflowEvent((event) => {
    if (event.workflowId) io.to(`workflow:${event.workflowId}`).emit('workflow_event', event)
  })
}

// Finish in-flight runs before exiting when the host restarts or redeploys us.
let shuttingDown = false
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, async () => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`[Server] ${signal} received, shutting down`)
    await fastify.close().catch(() => {})
    await stopQueue().catch(() => {})
    await prisma.$disconnect().catch(() => {})
    process.exit(0)
  })
}

main().catch((err) => {
  fastify.log.error(err)
  console.error('[Server] Failed to start:', err?.message || err)
  process.exit(1)
})
