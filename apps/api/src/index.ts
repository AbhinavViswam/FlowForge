import 'dotenv/config';
import Fastify from 'fastify'
import cors from '@fastify/cors'
import authPlugin from './plugins/auth'
import authRoutes from './routes/auth'
import workflowRoutes from './routes/workflows'
import webhookRoutes from './routes/webhooks'
import { initScheduler } from './scheduler'
import { initializeRedisConsumers } from './services/redis-consumer'

import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';

const fastify = Fastify({
  logger: true
})

fastify.register(helmet, {
  global: true,
  // We need cross-origin resource sharing to work correctly with localhost during dev
  crossOriginResourcePolicy: false,
});

fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute'
});

// Allow the dev UI plus any locally-served/opened tool (e.g. the webhook tester)
// to call the API from a browser. We accept any localhost/127.0.0.1 origin (any
// port) and file:// pages (origin is undefined/null), but nothing off-machine —
// so credentialed cookie requests stay limited to local origins.
const isLocalOrigin = (origin?: string) => {
  if (!origin) return true // non-browser clients or file:// pages
  try {
    const { hostname } = new URL(origin)
    return hostname === 'localhost' || hostname === '127.0.0.1'
  } catch {
    return false
  }
}

fastify.register(cors, {
  origin: (origin, cb) => cb(null, isLocalOrigin(origin)),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']
})

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

fastify.register(authPlugin)

fastify.register(authRoutes, { prefix: '/api/v1/auth' })
fastify.register(workflowRoutes, { prefix: '/api/v1/workflows' })
fastify.register(webhookRoutes, { prefix: '/webhooks' })
fastify.register(webhookRoutes, { prefix: '/api/v1/wh' })

fastify.get('/', async function handler (request, reply) {
  return { status: 'FlowForge API is running' }
})

// Run the server!
try {
  initScheduler(); // Start the cron background jobs
  initializeRedisConsumers().catch(err => console.error('[Redis] Consumer init failed', err)); // Redis-stream triggers
  fastify.listen({ port: 3000, host: '0.0.0.0' }, (err, address) => {
    if (err) throw err;
    console.log(`Server listening at ${address}`);

    const { Server } = require('socket.io');
    const Redis = require('ioredis');

    const io = new Server(fastify.server, {
      cors: {
        origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => cb(null, isLocalOrigin(origin)),
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
