import cron from 'node-cron';
import { prisma } from '../db';
import { executeWorkflow } from '@flowforge/workflow-engine';

// Keep track of active jobs so we can stop them if a workflow is deactivated or changed
const activeJobs = new Map<string, any>();

export async function initializeScheduler() {
  console.log('Initializing Workflow Scheduler...');
  await refreshCronJobs();

  // Poll for changes every minute
  setInterval(refreshCronJobs, 60000);
}

async function refreshCronJobs() {
  // Find all active workflows that have a published version
  const workflows = await prisma.workflow.findMany({
    where: { status: 'active' },
    include: {
      versions: {
        orderBy: { version: 'desc' },
        take: 1
      }
    }
  });

  const currentJobIds = new Set<string>();

  for (const workflow of workflows) {
    if (!workflow.versions || workflow.versions.length === 0) continue;
    const version = workflow.versions[0];
    if (!version.definition) continue;

    const definition = version.definition as any;
    const triggerNode = (definition.nodes || []).find((n: any) => n.type === 'trigger');
    if (!triggerNode) continue;

    const config = triggerNode.config || triggerNode.data || {};
    const triggerType = config.triggerType || 'webhook';

    // We only care about cron triggers
    if (triggerType !== 'cron') continue;

    const cronExpression = config.cronExpression || '*/5 * * * *';
    const timezone = config.timezone || 'UTC';
    
    // Create a unique key for this configuration
    const jobKey = `${workflow.id}_${version.id}_${cronExpression}_${timezone}`;
    currentJobIds.add(jobKey);

    if (!activeJobs.has(jobKey)) {
      console.log(`[Scheduler] Starting cron job for workflow '${workflow.name}' (${workflow.id}) with schedule '${cronExpression}'`);
      
      const task = cron.schedule(cronExpression, async () => {
        console.log(`[Scheduler] Triggering workflow '${workflow.name}'...`);
        try {
          const startTime = new Date();
          
          // Ingest pseudo-event
          const event = await prisma.event.create({
            data: {
              workflowId: workflow.id,
              externalEventId: `cron_${Date.now()}`,
              headers: { source: 'scheduler' },
              payload: { triggered_at: new Date().toISOString() },
              receivedAt: startTime
            }
          });

          // Run engine
          const result = await executeWorkflow(definition, { triggered_at: new Date().toISOString() });
          
          const execution = await prisma.execution.create({
            data: {
              workflowVersionId: version.id,
              eventId: event.id,
              status: result.status,
              startedAt: startTime,
              finishedAt: new Date()
            }
          });

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
            });
          }
          console.log(`[Scheduler] Workflow '${workflow.name}' completed with status: ${result.status}`);
        } catch (error) {
          console.error(`[Scheduler] Error executing workflow '${workflow.name}':`, error);
        }
      }, {
        timezone: timezone
      });

      activeJobs.set(jobKey, task);
    }
  }

  // Cleanup old or modified jobs
  for (const [jobKey, task] of activeJobs.entries()) {
    if (!currentJobIds.has(jobKey)) {
      console.log(`[Scheduler] Stopping removed/modified cron job ${jobKey}`);
      task.stop();
      activeJobs.delete(jobKey);
    }
  }
}
