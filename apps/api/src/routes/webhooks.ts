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
    const triggerConfig = (triggerNode?.config || triggerNode?.data || {}) as any;
    const authType = triggerConfig.authType || 'public';
    if (triggerNode) {
      const config = triggerConfig;

      if (authType === 'stripe') {
        // Stripe signs `${timestamp}.${rawBody}` with your endpoint secret (whsec_...)
        // and sends it as: stripe-signature: t=<ts>,v1=<hex>[,v1=<hex>...]
        const secret = config.authSecret;
        if (!secret) {
          return reply.code(500).send({ error: 'Stripe verification configured but no signing secret set on the trigger node.' });
        }
        const rawSig = request.headers['stripe-signature'];
        const signature = Array.isArray(rawSig) ? rawSig[0] : rawSig;
        if (!signature) {
          return reply.code(401).send({ error: 'Unauthorized: Missing stripe-signature header' });
        }

        let timestamp = '';
        const v1s: string[] = [];
        for (const part of signature.split(',')) {
          const idx = part.indexOf('=');
          if (idx === -1) continue;
          const k = part.slice(0, idx).trim();
          const v = part.slice(idx + 1).trim();
          if (k === 't') timestamp = v;
          else if (k === 'v1') v1s.push(v);
        }
        if (!timestamp || v1s.length === 0) {
          return reply.code(401).send({ error: 'Unauthorized: Malformed stripe-signature header' });
        }

        // Reject events outside a 5-minute window (replay protection).
        const toleranceSec = 5 * 60;
        const nowSec = Math.floor(Date.now() / 1000);
        if (!Number.isFinite(Number(timestamp)) || Math.abs(nowSec - Number(timestamp)) > toleranceSec) {
          return reply.code(401).send({ error: 'Unauthorized: Stripe signature timestamp outside tolerance' });
        }

        const crypto = require('crypto');
        const rawBody = (request as any).rawBody ?? JSON.stringify(payload);
        const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
        const expBuf = Buffer.from(expected, 'utf8');
        const valid = v1s.some((v) => {
          const b = Buffer.from(v, 'utf8');
          return b.length === expBuf.length && crypto.timingSafeEqual(b, expBuf);
        });
        if (!valid) {
          return reply.code(401).send({ error: 'Unauthorized: Invalid Stripe signature' });
        }
      } else if (authType === 'bearer') {
        const expectedToken = config.authSecret;
        const authHeader = request.headers['authorization'];
        if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== expectedToken) {
          return reply.code(401).send({ error: 'Unauthorized: Invalid or missing Bearer token' });
        }
      } else if (authType === 'hmac') {
        const headerName = (config.authHeaderName || '').toLowerCase();
        const secret = config.authSecret;
        const rawSig = request.headers[headerName];
        const signature = Array.isArray(rawSig) ? rawSig[0] : rawSig;

        if (!signature) {
          return reply.code(401).send({ error: `Unauthorized: Missing HMAC signature in header '${headerName}'` });
        }
        if (!secret) {
          return reply.code(500).send({ error: 'HMAC configured but no signing secret set on the trigger node.' });
        }

        const crypto = require('crypto');
        // Verify against the EXACT received bytes, not a re-serialized copy.
        const rawBody = (request as any).rawBody ?? JSON.stringify(payload);
        const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

        // Accept a bare hex digest or a "sha256=<hex>" prefixed value (GitHub style).
        const provided = signature.startsWith('sha256=') ? signature.slice(7) : signature;

        const a = Buffer.from(provided, 'utf8');
        const b = Buffer.from(computed, 'utf8');
        const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
        if (!valid) {
          return reply.code(401).send({ error: 'Unauthorized: Invalid HMAC signature' });
        }
      }
    }

    // Idempotency: if we can identify the event stably (x-event-id / idempotency-key
    // header, or a Stripe event id in the body), don't ingest or execute it twice.
    const stripeEventId = authType === 'stripe' && typeof (payload as any)?.id === 'string' ? (payload as any).id : undefined
    const idempotencyKey = (headers['x-event-id'] as string) || (headers['idempotency-key'] as string) || stripeEventId
    if (idempotencyKey) {
      const existing = await prisma.event.findFirst({
        where: { workflowId, externalEventId: idempotencyKey },
        include: { executions: { orderBy: { startedAt: 'desc' }, take: 1 } }
      })
      if (existing) {
        return reply.code(200).send({
          received: true,
          deduplicated: true,
          workflowId: workflow.id,
          eventId: existing.id,
          executionId: existing.executions[0]?.id ?? null,
          status: 'duplicate',
          message: 'Event already ingested; idempotent replay ignored.'
        })
      }
    }

    // Ingest event into database
    const externalEventId = idempotencyKey || (headers['stripe-signature'] ? 'stripe_' + Date.now() : `wh_${Date.now()}`)
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
