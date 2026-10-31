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
import { configuredOrigins, isAllowedOrigin, isPublicWebhookPath } from './origins'

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

fastify.register(helmet, {
  global: true,
  // We need cross-origin resource sharing to work correctly with localhost during dev
  crossOriginResourcePolicy: false,
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
  if (origin && !isAllowedOrigin(origin)) {
    return reply.code(403).send({ error: 'Requests from this website are not allowed.' })
  }
})

if (process.env.NODE_ENV === 'production' && configuredOrigins().length === 0) {
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

fastify.get('/', async function handler (request, reply) {
  return { status: 'FlowForge API is running' }
})

// Run the server!
try {
  initScheduler(); // Start the cron background jobs
  initializeRedisConsumers().catch(err => console.error('[Redis] Consumer init failed', err)); // Redis-stream triggers
  // Report (and test) the sign-up email sender at startup so a bad password shows up now.
  verifyMailConfig().then(({ ok, message }) => (ok ? console.log : console.error)(`[Mailer] ${message}`));
  fastify.listen({ port: 3000, host: '0.0.0.0' }, (err, address) => {
    if (err) throw err;
    console.log(`Server listening at ${address}`);

    const { Server } = require('socket.io');
    const Redis = require('ioredis');

    const io = new Server(fastify.server, {
      cors: {
        origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => cb(null, isAllowedOrigin(origin)),
        methods: ["GET", "POST"],
        credentials: true
      }
    });

    io.on('connection', (socket: any) => {
      console.log('[Socket] Client connected:', socket.id);
      
      socket.on('join_workflow', (workflowId: string) => {
        socket.join(`workflow:${workflowId}`);
        console.log(`[Socket] ${socket.id} joined workflow:${workflowId}`);
      });
    });

    const redisSubscriber = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    });

    redisSubscriber.subscribe('workflow-events', (subscribeErr: any) => {
      if (subscribeErr) console.error('[Redis] Failed to subscribe', subscribeErr);
    });

    redisSubscriber.on('message', (channel: string, message: string) => {
      if (channel === 'workflow-events') {
        try {
          const data = JSON.parse(message);
          if (data.workflowId) {
            io.to(`workflow:${data.workflowId}`).emit('workflow_event', data);
          }
        } catch (e) {
          // ignore
        }
      }
    });
  });
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
