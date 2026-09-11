import 'dotenv/config';
import Fastify from 'fastify'
import cors from '@fastify/cors'
import authPlugin from './plugins/auth'
import authRoutes from './routes/auth'
import workflowRoutes from './routes/workflows'

const fastify = Fastify({
  logger: true
})

fastify.register(cors, {
  origin: 'http://localhost:5173', // Vite default port
  credentials: true
})

fastify.register(authPlugin)

fastify.register(authRoutes, { prefix: '/api/v1/auth' })
fastify.register(workflowRoutes, { prefix: '/api/v1/workflows' })

fastify.get('/', async function handler (request, reply) {
  return { status: 'FlowForge API is running' }
})

// Run the server!
try {
  fastify.listen({ port: 3000, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
