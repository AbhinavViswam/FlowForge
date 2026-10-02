import { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { 
  createWorkflowSchema, 
  updateWorkflowSchema, 
  activateWorkflowSchema 
} from '@flowforge/shared'
import { executeWorkflow, DEFAULT_TEST_PAYLOAD, SmtpCredentials } from '@flowforge/workflow-engine'
import { decryptSecret } from '../crypto'
import { reloadCronJobs } from '../scheduler'
import { workflowQueue } from '../queue'
import { generateWorkflow } from '../ai'

// Resolve + decrypt the email connections referenced by a definition, scoped to
// the owning user, so test runs use the same saved accounts the worker would.
async function resolveConnectionsForUser(definition: any, userId: string): Promise<Record<string, SmtpCredentials>> {
  const ids = Array.from(new Set(
    (definition?.nodes || [])
      .map((n: any) => (n?.config || n?.data || {}).connectionId)
      .filter((v: any): v is string => typeof v === 'string' && v.length > 0)
  )) as string[]
  if (ids.length === 0) return {}
  const rows = await prisma.connection.findMany({ where: { id: { in: ids }, userId } })
  const map: Record<string, SmtpCredentials> = {}
  for (const row of rows) {
    try {
      const meta = (row.meta || {}) as any
      map[row.id] = {
        host: meta.host || 'smtp.gmail.com',
        port: meta.port || (meta.secure ? 465 : 587),
        secure: !!meta.secure,
        user: meta.username || '',
        pass: decryptSecret(row.secret),
        from: meta.fromAddress || meta.username || '',
      }
    } catch (err) {
      request_log_safe(err)
    }
  }
  return map
}

function request_log_safe(err: unknown) {
  // eslint-disable-next-line no-console
  console.error('[API] Failed to decrypt a connection for test run:', (err as Error).message)
}

export default async function workflowRoutes(fastify: FastifyInstance) {
  // All workflow routes require authentication
  fastify.addHook('onRequest', fastify.authenticate)

  fastify.get('/', async (request, reply) => {
    const user = request.user as any
    const workflows = await prisma.workflow.findMany({
      where: { userId: user.id }
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

    if (data.prompt) {
      // AI generation
      const definition = await generateWorkflow(data.prompt);
      
      // Save it into a new draft version
      await prisma.workflowVersion.create({
        data: {
          workflowId: workflow.id,
          version: 1,
          definition
        }
      });
      
      // Update active version to the generated one so it's loaded in UI
      const updatedWorkflow = await prisma.workflow.update({
        where: { id: workflow.id },
        data: {
          activeVersionId: (await prisma.workflowVersion.findFirst({ where: { workflowId: workflow.id } }))?.id
        }
      });
      return { workflow: updatedWorkflow };
    }
    
    return { workflow }
  })

    fastify.get('/stats', async (request, reply) => {
      const user = request.user as any
      const totalExecutions = await prisma.execution.count({
        where: { workflowVersion: { workflow: { userId: user.id } } }
      })
      const successfulExecutions = await prisma.execution.count({
        where: { 
          workflowVersion: { workflow: { userId: user.id } },
          status: 'completed'
        }
      })
      const successRate = totalExecutions === 0 ? 0 : Math.round((successfulExecutions / totalExecutions) * 100)
      
      return {
        totalExecutions,
        successRate
      }
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
    
    reloadCronJobs()

    return { version: activated }
  })

  fastify.post('/:id/deactivate', async (request, reply) => {
    const user = request.user as any
    const { id } = request.params as { id: string }
    const workflow = await prisma.workflow.findFirst({
      where: { id, userId: user.id }
    })
    if (!workflow) return reply.code(404).send({ error: 'Workflow not found' })
    await prisma.workflow.update({
      where: { id },
      data: { status: 'draft' }
    })
    reloadCronJobs();
    return { success: true }
  })

  fastify.post('/:id/retry-execution', async (request, reply) => {
    const user = request.user as any;
    const { id: executionId } = request.params as { id: string };

    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
      include: {
        workflowVersion: {
          include: {
            workflow: true
          }
        },
        event: true
      }
    });

    if (!execution || execution.workflowVersion.workflow.userId !== user.id) {
      return reply.code(404).send({ error: 'Execution not found' });
    }

    if (execution.status !== 'failed') {
      return reply.code(400).send({ error: 'Only failed executions can be manually retried' });
    }

    // Set execution back to queued
    await prisma.execution.update({
      where: { id: executionId },
      data: { status: 'queued' }
    });

    // Enqueue job for manual retry
    await workflowQueue.add('execute', {
      executionId: execution.id,
      workflowVersionId: execution.workflowVersionId,
      eventId: execution.eventId,
      payload: execution.event.payload
    });

    return { success: true, message: 'Execution successfully re-queued for retry.' };
  });

  fastify.delete('/:id', async (request, reply) => {
    const user = request.user as any
    const { id } = request.params as { id: string }
    
    // Find all versions of this workflow
    const versions = await prisma.workflowVersion.findMany({ where: { workflowId: id } });
    const versionIds = versions.map(v => v.id);

    // Find all executions for these versions
    const executions = await prisma.execution.findMany({ where: { workflowVersionId: { in: versionIds } } });
    const executionIds = executions.map(e => e.id);

    // Manually delete children in order to satisfy foreign key constraints
    // since the DB was migrated before ON DELETE CASCADE was added
    await prisma.nodeExecution.deleteMany({ where: { executionId: { in: executionIds } } });
    await prisma.execution.deleteMany({ where: { workflowVersionId: { in: versionIds } } });
    await prisma.workflowEdge.deleteMany({ where: { workflowVersionId: { in: versionIds } } });
    await prisma.workflowNode.deleteMany({ where: { workflowVersionId: { in: versionIds } } });
    await prisma.workflowVersion.deleteMany({ where: { workflowId: id } });
    await prisma.event.deleteMany({ where: { workflowId: id } });

    // Finally delete the workflow itself
    await prisma.workflow.deleteMany({
      where: { id, userId: user.id }
    })
    
    return { success: true }
  })

  fastify.post('/:id/test', async (request, reply) => {
    const user = request.user as any
    const { id } = request.params as { id: string }
    const body = (request.body as any) || {}
    const testPayload = body.payload || DEFAULT_TEST_PAYLOAD

    let definition = body.definition
    let workflow: any = null
    let activeVersionId: string | null = null

    if (id !== 'new') {
      workflow = await prisma.workflow.findFirst({
        where: { id, userId: user.id },
        include: {
          versions: {
            orderBy: { version: 'desc' },
            take: 1
          }
        }
      })
      if (workflow && workflow.versions.length > 0) {
        activeVersionId = workflow.activeVersionId || workflow.versions[0].id
        if (!definition) {
          definition = workflow.versions[0].definition
        }
      }
    }

    if (!definition || !definition.nodes || !Array.isArray(definition.nodes)) {
      return reply.code(400).send({ error: 'No workflow definition nodes found to execute test.' })
    }

    const resolvedConnections = await resolveConnectionsForUser(definition, user.id)

    const startTime = new Date()
    const result = await executeWorkflow(definition, testPayload, undefined, undefined, undefined, { connections: resolvedConnections })
    const finishedTime = new Date()

    // Persist to Prisma if workflow and version exist in DB
    if (workflow && activeVersionId) {
      try {
        const event = await prisma.event.create({
          data: {
            workflowId: workflow.id,
            externalEventId: `test_${Date.now()}`,
            headers: { 'x-flowforge-trigger': 'manual-test-run' },
            payload: testPayload,
            receivedAt: startTime
          }
        })

        const execution = await prisma.execution.create({
          data: {
            workflowVersionId: activeVersionId,
            eventId: event.id,
            status: result.status,
            startedAt: startTime,
            finishedAt: finishedTime
          }
        })

        for (const [nodeId, nResult] of Object.entries(result.nodeResults)) {
          await prisma.nodeExecution.create({
            data: {
              executionId: execution.id,
              nodeId,
              status: nResult.status,
              input: nResult.input || {},
              output: nResult.output || {},
              error: nResult.error || null,
              attempts: 1
            }
          })
        }
      } catch (dbErr) {
        fastify.log.warn({ err: dbErr }, 'Failed to persist test execution trace to DB')
      }
    }

    return {
      success: result.status === 'completed',
      executionId: result.executionId,
      status: result.status,
      totalDurationMs: result.totalDurationMs,
      nodeResults: result.nodeResults,
      logs: result.logs,
      output: result.output,
      error: result.error
    }
  })

  fastify.get('/:id/executions', async (request, reply) => {
    const user = request.user as any
    const { id } = request.params as { id: string }

    const workflow = await prisma.workflow.findFirst({
      where: { id, userId: user.id }
    })
    if (!workflow) return reply.code(404).send({ error: 'Workflow not found' })

    const executions = await prisma.execution.findMany({
      where: { workflowVersion: { workflowId: id } },
      orderBy: { startedAt: 'desc' },
      take: 25,
      include: {
        event: true,
        nodeExecutions: true
      }
    })

    return { executions }
  })
}

