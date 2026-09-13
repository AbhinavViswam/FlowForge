import 'dotenv/config';
import Fastify from 'fastify'
import cors from '@fastify/cors'
import authPlugin from './plugins/auth'
import authRoutes from './routes/auth'
import workflowRoutes from './routes/workflows'
import webhookRoutes from './routes/webhooks'
import { initScheduler } from './scheduler'

const fastify = Fastify({
  logger: true
})

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
  fastify.listen({ port: 3000, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
// touch
