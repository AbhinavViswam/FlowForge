import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { prisma } from './db';
import { executeWorkflow, SmtpCredentials } from '@flowforge/workflow-engine';
import { decryptSecret } from './crypto';

// Collect every connectionId referenced by email steps, load the owner's
// connections, decrypt their secrets, and return a resolved creds map for the
// engine. Failures for one connection are logged and skipped (that step then
// falls back to env/simulation) rather than failing the whole run.
async function resolveConnections(definition: any, userId: string): Promise<Record<string, SmtpCredentials>> {
  const ids = Array.from(new Set(
    (definition?.nodes || [])
      .map((n: any) => (n?.config || n?.data || {}).connectionId)
      .filter((v: any): v is string => typeof v === 'string' && v.length > 0)
  ));
  if (ids.length === 0) return {};

  const rows = await prisma.connection.findMany({ where: { id: { in: ids as string[] }, userId } });
  const map: Record<string, SmtpCredentials> = {};
  for (const row of rows) {
    try {
      const meta = (row.meta || {}) as any;
      map[row.id] = {
        host: meta.host || 'smtp.gmail.com',
        port: meta.port || (meta.secure ? 465 : 587),
        secure: !!meta.secure,
        user: meta.username || '',
        pass: decryptSecret(row.secret),
        from: meta.fromAddress || meta.username || '',
      };
    } catch (err) {
      console.error(`[Worker] Failed to decrypt connection ${row.id}:`, (err as Error).message);
    }
  }
  return map;
}

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  maxRetriesPerRequest: null,
};

console.log('Starting FlowForge BullMQ Worker...');

const worker = new Worker('workflow-execution', async (job: Job) => {
  const { executionId, workflowVersionId, payload } = job.data;
  console.log(`[Worker] Picked up job for execution: ${executionId}`);

  try {
    const version = await prisma.workflowVersion.findUnique({
      where: { id: workflowVersionId },
      include: { workflow: { select: { userId: true } } }
    });

    if (!version || !version.definition) {
      throw new Error(`Workflow version ${workflowVersionId} not found or missing definition`);
    }

    const definition = version.definition as any;

    // Resolve any saved email connections this workflow references (decrypted).
    const resolvedConnections = await resolveConnections(definition, version.workflow.userId);

    const previousNodes = await prisma.nodeExecution.findMany({
      where: { executionId }
    });
    
    const previousResults: Record<string, any> = {};
    for (const n of previousNodes) {
      if (n.status === 'completed') {
        previousResults[n.nodeId] = n;
      }
    }

    // Execute the workflow using our isolated engine
    const startTime = Date.now();
    console.log(`[Worker] Executing engine for execution: ${executionId} (Attempt: ${job.attemptsMade + 1})`);
    
    // Create a local redis client for publishing events
    const redisPublisher = new Redis(connection);
    
    const publishEvent = (type: string, payload: any) => {
      redisPublisher.publish('workflow-events', JSON.stringify({
        executionId,
        workflowId: version.workflowId,
        type,
        payload
      })).catch(() => {}); // ignore publish errors
    };
    
    // Publish a start event
    publishEvent('execution_started', { startedAt: new Date().toISOString(), attempt: job.attemptsMade + 1 });

    const result = await executeWorkflow(
      definition,
      payload,
      previousResults,
      (log) => publishEvent('log', log),
      (nodeRes) => publishEvent('node_complete', nodeRes),
      { connections: resolvedConnections }
    );
    
    publishEvent('execution_finished', { status: result.status, durationMs: Date.now() - startTime });

    redisPublisher.disconnect();

    const finishedTime = Date.now();

    // 1. Update Execution table
    await prisma.execution.update({
      where: { id: executionId },
      data: {
        status: result.status,
        finishedAt: new Date(finishedTime)
      }
    });

    // 2. Upsert NodeExecutions
    for (const [nodeId, nResult] of Object.entries(result.nodeResults)) {
      // If it was already completed previously, skip updating the DB
      if (previousResults[nodeId] && nResult.status === 'completed') {
        continue; 
      }
      
      const existing = previousNodes.find(n => n.nodeId === nodeId);
      const attempts = (existing?.attempts || 0) + 1;

      if (existing) {
        await prisma.nodeExecution.update({
          where: { id: existing.id },
          data: {
            status: nResult.status,
            output: nResult.output || {},
            error: nResult.error || null,
            attempts
          }
        });
      } else {
        await prisma.nodeExecution.create({
          data: {
            executionId: executionId,
            nodeId: nodeId,
            status: nResult.status,
            input: nResult.input || {},
            output: nResult.output || {},
            error: nResult.error || null,
            attempts: 1
          }
        });
      }
    }

    console.log(`[Worker] Execution ${executionId} completed with status: ${result.status}`);
    
    if (result.status === 'failed') {
      // Throwing an error triggers BullMQ's automatic retry backoff mechanism
      throw new Error(`Workflow execution failed at one or more nodes.`);
    }

    return result;

  } catch (error: any) {
    console.error(`[Worker] Fatal error processing execution ${executionId}:`, error);
    
    await prisma.execution.update({
      where: { id: executionId },
      data: {
        status: 'failed',
        finishedAt: new Date()
      }
    });
    
    throw error;
  }
}, { connection });

worker.on('completed', job => {
  console.log(`Job ${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
  console.log(`Job ${job?.id} has failed with ${err.message}`);
});
