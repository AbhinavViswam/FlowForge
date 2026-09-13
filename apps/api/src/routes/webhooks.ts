import { FastifyInstance } from 'fastify'
import { prisma } from '../db'
import { executeWorkflow, DEFAULT_TEST_PAYLOAD } from '@flowforge/workflow-engine'
import { workflowQueue } from '../queue'

export default async function webhookRoutes(fastify: FastifyInstance) {
  // Public webhook ingestion endpoint - accessible without user session cookies
  fastify.post('/:workflowId', async (request, reply) => {
    const { workflowId } = request.params as { workflowId: string }
    const headers = request.headers
    const payload = (request.body as any) || DEFAULT_TEST_PAYLOAD

    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 1
        }
      }
    })

    if (!workflow) {
      return reply.code(404).send({
        error: `Workflow with ID '${workflowId}' not found.`
      })
    }

    if (workflow.status !== 'active') {
      return reply.code(400).send({
        error: `Workflow '${workflow.name}' is currently in '${workflow.status}' status. Deploy and activate the workflow to process incoming webhooks.`
      })
    }

    const version = workflow.versions[0]
    if (!version || !version.definition) {
      return reply.code(400).send({
        error: 'Active workflow version definition not found.'
      })
    }

    const definition = version.definition as any
    const startTime = new Date()

    // Auth Validation based on trigger node config
    const triggerNode = (definition.nodes || []).find((n: any) => n.type === 'trigger');
    if (triggerNode) {
      const config = triggerNode.config || triggerNode.data || {};
      const authType = config.authType || 'public';
      
      if (authType === 'bearer') {
        const expectedToken = config.authSecret;
        const authHeader = request.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== expectedToken) {
          return reply.code(401).send({ error: 'Unauthorized: Invalid or missing Bearer token' });
        }
      } else if (authType === 'hmac') {
        const headerName = (config.authHeaderName || '').toLowerCase();
        const secret = config.authSecret;
        const signature = request.headers[headerName];
        
        if (!signature) {
          return reply.code(401).send({ error: `Unauthorized: Missing HMAC signature in header '${headerName}'` });
        }
        
        const crypto = require('crypto');
        // Simple HMAC validation assuming JSON payload
        const rawBody = JSON.stringify(payload);
        const computedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
        
        // Also allow matching if the signature contains the computed signature (e.g. Stripe format)
        if (signature !== computedSignature && !(typeof signature === 'string' && signature.includes(computedSignature))) {
          return reply.code(401).send({ error: 'Unauthorized: Invalid HMAC signature' });
        }
      }
    }

    // Ingest event into database
    const externalEventId = (headers['x-event-id'] as string) || (headers['stripe-signature'] ? 'stripe_' + Date.now() : `wh_${Date.now()}`)
    const event = await prisma.event.create({
      data: {
        workflowId,
        externalEventId,
        headers: headers as any,
        payload: payload,
        receivedAt: startTime
      }
    })

    // Persist Execution trace
    const execution = await prisma.execution.create({
      data: {
        workflowVersionId: version.id,
        eventId: event.id,
        status: 'queued',
        startedAt: startTime,
      }
    })

    // Enqueue the job for the worker with exponential backoff (up to 4 attempts: 1s, 2s, 4s...)
    await workflowQueue.add('execute', {
      executionId: execution.id,
      workflowVersionId: version.id,
      eventId: event.id,
      payload: payload
    }, {
      attempts: 4,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });

    return reply.code(202).send({
      received: true,
      workflowId: workflow.id,
      workflowName: workflow.name,
      eventId: event.id,
      executionId: execution.id,
      status: 'queued',
      message: 'Event accepted and queued for execution.'
    })
  })

  // GET handler for convenient testing via browser or curl
  fastify.get('/:workflowId', async (request, reply) => {
    const { workflowId } = request.params as { workflowId: string }
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { id: true, name: true, status: true }
    })

    if (!workflow) {
      return reply.code(404).send({ error: `Workflow '${workflowId}' not found.` })
    }

    return {
      endpoint: `/api/v1/wh/${workflowId}`,
      method: 'POST',
      workflowName: workflow.name,
      status: workflow.status,
      info: 'Send a POST request with JSON payload to this endpoint to trigger the workflow pipeline.',
      sampleCurl: `curl -X POST http://localhost:3000/api/v1/wh/${workflowId} -H "Content-Type: application/json" -d '{"account_tier":"enterprise","event":"order.created","amount":250}'`
    }
  })
}
