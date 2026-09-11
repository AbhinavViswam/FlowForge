import { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { 
  createWorkflowSchema, 
  updateWorkflowSchema, 
  activateWorkflowSchema 
} from '@flowforge/shared'

export default async function workflowRoutes(fastify: FastifyInstance) {
  // All workflow routes require authentication
  fastify.addHook('onRequest', fastify.authenticate)

  fastify.get('/', async (request, reply) => {
    const user = request.user as any
    const workflows = await prisma.workflow.findMany({
      where: { userId: user.id },
      orderBy: { id: 'desc' }
    })
    return { workflows }
  })

  fastify.post('/', async (request, reply) => {
    const user = request.user as any
    const data = createWorkflowSchema.parse(request.body)
    
    const workflow = await prisma.workflow.create({
      data: {
        userId: user.id,
        name: data.name,
        status: 'draft'
      }
    })
    
    return { workflow }
  })

  fastify.get('/:id', async (request, reply) => {
    const user = request.user as any
    const { id } = request.params as { id: string }
    
    const workflow = await prisma.workflow.findFirst({
      where: { id, userId: user.id },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1
        }
      }
    })
    
    if (!workflow) return reply.code(404).send({ error: 'Workflow not found' })
    return { workflow }
  })

  fastify.put('/:id', async (request, reply) => {
    const user = request.user as any
    const { id } = request.params as { id: string }
    const data = updateWorkflowSchema.parse(request.body)
    
    const workflow = await prisma.workflow.findFirst({
      where: { id, userId: user.id }
    })
    
    if (!workflow) return reply.code(404).send({ error: 'Workflow not found' })
    
    // Normally you'd save draft definition somewhere, but for simplicity we'll 
    // update the name if provided. The draft definition could be stored in a separate table or column.
    // For this MVP, we focus on the activation step which saves the immutable version.
    
    const updated = await prisma.workflow.update({
      where: { id },
      data: { name: data.name ?? workflow.name }
    })
    
    return { workflow: updated }
  })

  fastify.post('/:id/activate', async (request, reply) => {
    const user = request.user as any
    const { id } = request.params as { id: string }
    
    const workflow = await prisma.workflow.findFirst({
      where: { id, userId: user.id }
    })
    if (!workflow) return reply.code(404).send({ error: 'Workflow not found' })
    
    // Validate the complete definition using Zod
    const definition = activateWorkflowSchema.parse(request.body)
    
    // Determine the next version number
    const lastVersion = await prisma.workflowVersion.findFirst({
      where: { workflowId: id },
      orderBy: { version: 'desc' }
    })
    const nextVersion = lastVersion ? lastVersion.version + 1 : 1
    
    // Create new immutable version and nodes/edges in a transaction
    const activated = await prisma.$transaction(async (tx) => {
      const version = await tx.workflowVersion.create({
        data: {
          workflowId: id,
          version: nextVersion,
          definition: definition as any
        }
      })
      
      // Update workflow status
      await tx.workflow.update({
        where: { id },
        data: {
          status: 'active',
          activeVersionId: version.id
        }
      })
      
      // We could also populate WorkflowNode and WorkflowEdge tables here for relational queries,
      // but storing the full definition JSON in the version table is often enough for execution.
      
      return version
    })
    
    return { version: activated }
  })
}

