import 'dotenv/config';
import Fastify from 'fastify'
import cors from '@fastify/cors'
import authPlugin from './plugins/auth'
import authRoutes from './routes/auth'
import workflowRoutes from './routes/workflows'
import webhookRoutes from './routes/webhooks'
import { initScheduler } from './scheduler'

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

fastify.register(cors, {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH']
})

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
  fastify.listen({ port: 3000, host: '0.0.0.0' }, (err, address) => {
    if (err) throw err;
    console.log(`Server listening at ${address}`);

    const { Server } = require('socket.io');
    const Redis = require('ioredis');

    const io = new Server(fastify.server, {
      cors: {
        origin: "http://localhost:5173",
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
