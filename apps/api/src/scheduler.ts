import cron from 'node-cron';
import { prisma } from './db';
import { workflowQueue } from './queue';

const activeJobs = new Map<string, any>();

export async function initScheduler() {
  console.log('[Scheduler] Initializing cron scheduler...');
  await reloadCronJobs();
  
  // Periodically check for new or updated active workflows
  setInterval(reloadCronJobs, 60000); // Check every 60s
}

export async function reloadCronJobs() {
  const activeWorkflows = await prisma.workflow.findMany({
    where: { status: 'active' },
    include: {
      versions: {
        orderBy: { version: 'desc' },
        take: 1
      }
    }
  });

  const currentJobIds = new Set<string>();

  for (const wf of activeWorkflows) {
    if (wf.versions.length === 0) continue;
    const version = wf.versions[0];
    const def: any = version.definition;
    if (!def.nodes || !Array.isArray(def.nodes)) continue;

    // Find trigger nodes
    const triggerNodes = def.nodes.filter((n: any) => n.type === 'trigger');
    for (const trigger of triggerNodes) {
      if (trigger.data?.triggerType === 'cron') {
        const expr = trigger.data.cronExpression || '0 * * * *';
        const jobId = `${wf.id}_${trigger.id}`;
        currentJobIds.add(jobId);

        // If job already running with same id, skip
        if (!activeJobs.has(jobId)) {
          if (cron.validate(expr)) {
            console.log(`[Scheduler] Scheduling ${wf.name} on ${expr}`);
            const task = cron.schedule(expr, async () => {
              console.log(`[Scheduler] Triggering ${wf.name}`);
              
              const event = await prisma.event.create({
                data: {
                  workflowId: wf.id,
                  type: 'cron',
                  payload: { timestamp: new Date().toISOString() },
                  externalEventId: `cron-${Date.now()}`
                }
              });

              const execution = await prisma.execution.create({
                data: {
                  workflowVersionId: version.id,
                  eventId: event.id,
                  status: 'queued',
                  startedAt: new Date(),
                }
              });

              // Enqueue the cron job execution to BullMQ
              await workflowQueue.add('execute', {
                executionId: execution.id,
                workflowVersionId: version.id,
                eventId: event.id,
                payload: { event: 'cron_trigger', timestamp: new Date().toISOString() }
              }, {
                attempts: 4,
                backoff: {
                  type: 'exponential',
                  delay: 2000
                }
              });
            });
            activeJobs.set(jobId, task);
          }
        }
      }
    }
  }

  // Stop jobs that are no longer active
  for (const [jobId, task] of activeJobs.entries()) {
    if (!currentJobIds.has(jobId)) {
      console.log(`[Scheduler] Stopping inactive job ${jobId}`);
      task.stop();
      activeJobs.delete(jobId);
    }
  }
}

