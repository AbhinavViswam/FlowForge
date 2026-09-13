import { Worker, Job } from 'bullmq';
import { prisma } from './db';
import { executeWorkflow } from '@flowforge/workflow-engine';

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
      where: { id: workflowVersionId }
    });

    if (!version || !version.definition) {
      throw new Error(`Workflow version ${workflowVersionId} not found or missing definition`);
    }

    const definition = version.definition as any;

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
    
    const result = await executeWorkflow(definition, payload, previousResults);
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
