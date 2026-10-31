import Redis from 'ioredis';
import { prisma } from '../db';
import { workflowQueue } from '../queue';
import { assertPublicHost, openSecret } from '@flowforge/workflow-engine';

const undecryptable = new Set<string>(); // warn once per workflow

// Consumers whose host check is in progress, and ones already reported as blocked
// (so a refused URI is logged once, not every minute).
const startingConsumers = new Set<string>();
const blockedConsumers = new Set<string>();

// Keep track of active consumers
const activeConsumers = new Map<string, { redis: Redis, running: boolean }>();

export async function initializeRedisConsumers() {
  console.log('Initializing Redis Stream Consumers...');
  await refreshRedisConsumers();

  // Poll for changes every minute
  setInterval(refreshRedisConsumers, 60000);
}

export async function refreshRedisConsumers() {
  const workflows = await prisma.workflow.findMany({
    where: { status: 'active' },
    include: {
      versions: {
        orderBy: { version: 'desc' },
        take: 1
      }
    }
  });

  const currentConsumerIds = new Set<string>();

  for (const workflow of workflows) {
    if (!workflow.versions || workflow.versions.length === 0) continue;
    const version = workflow.versions[0];
    if (!version.definition) continue;

    const definition = version.definition as any;
    const triggerNode = (definition.nodes || []).find((n: any) => n.type === 'trigger');
    if (!triggerNode) continue;

    const config = triggerNode.config || triggerNode.data || {};
    const triggerType = config.triggerType || 'webhook';

    if (triggerType !== 'redis') continue;

    // Stored encrypted; decrypt only to connect. An unreadable value counts as missing.
    let redisUri = '';
    try { redisUri = openSecret(config.redisUri); } catch { if (!undecryptable.has(workflow.id)) { undecryptable.add(workflow.id); console.warn(`[Redis] Could not decrypt the connection URI for workflow '${workflow.name}' (was ENCRYPTION_KEY changed?)`); } }
    const redisTopic = config.redisTopic || 'events';
    const consumerGroup = config.redisConsumerGroup || 'flowforge-workers';
    // Stable name (not the process id) so messages left unacknowledged before an
    // API restart are replayed by the next consumer instead of being stranded.
    const consumerName = `flowforge-${workflow.id}`;
    
    if (!redisUri) continue; // Skip if no connection URI provided

    const consumerKey = `${workflow.id}_${version.id}_${redisTopic}_${consumerGroup}`;
    currentConsumerIds.add(consumerKey);

    if (!activeConsumers.has(consumerKey) && !startingConsumers.has(consumerKey)) {
      // The Redis server is user-supplied: refuse anything on the private network.
      startingConsumers.add(consumerKey);
      try {
        let host = '';
        try { host = new URL(redisUri).hostname; } catch { throw new Error('Invalid Redis connection URI (expected redis://host:port)'); }
        await assertPublicHost(host);
      } catch (err: any) {
        if (!blockedConsumers.has(consumerKey)) {
          blockedConsumers.add(consumerKey);
          console.warn(`[Redis] Not starting consumer for workflow '${workflow.name}': ${err.message}`);
        }
        continue;
      } finally {
        startingConsumers.delete(consumerKey);
      }

      console.log(`[Redis] Starting consumer for workflow '${workflow.name}' on stream '${redisTopic}'`);

      try {
        const redis = new Redis(redisUri);
        // Register before any await so an overlapping refresh can't start a duplicate.
        const state = { redis, running: true };
        activeConsumers.set(consumerKey, state);
        
        // Ensure consumer group exists
        try {
          await redis.xgroup('CREATE', redisTopic, consumerGroup, '$', 'MKSTREAM');
        } catch (err: any) {
          if (!err.message.includes('BUSYGROUP')) {
            console.error(`[Redis] Failed to create group: ${err.message}`);
          }
        }

        // Start listening loop
        consumeLoop(workflow, version, definition, state, redisTopic, consumerGroup, consumerName);

      } catch (err) {
        console.error(`[Redis] Failed to connect for workflow '${workflow.name}':`, err);
      }
    }
  }

  // Cleanup old consumers
  for (const [key, state] of activeConsumers.entries()) {
    if (!currentConsumerIds.has(key)) {
      console.log(`[Redis] Stopping removed/modified consumer ${key}`);
      state.running = false;
      // disconnect (not quit) aborts a blocking read right away, so a stopped
      // consumer cannot pick up one more message after the trigger is switched off.
      state.redis.disconnect();
      activeConsumers.delete(key);
    }
  }
}

async function consumeLoop(workflow: any, version: any, definition: any, state: { redis: Redis, running: boolean }, topic: string, group: string, name: string) {
  // Start by re-reading messages this consumer received earlier but never
  // acknowledged ('0'), e.g. one that arrived as the trigger was being stopped;
  // once that backlog is empty, switch to new messages ('>').
  let cursor = '0';
  while (state.running) {
    try {
      const results = await (state.redis as any).xreadgroup('GROUP', group, name, 'BLOCK', 5000, 'COUNT', 1, 'STREAMS', topic, cursor);
      if (!state.running) break; // stopped while waiting: leave it pending for next start
      if (cursor === '0' && (!results || !results[0] || results[0][1].length === 0)) {
        cursor = '>';
        continue;
      }
      if (results && results.length > 0) {
        const [stream, messages] = results[0];
        
        for (const [messageId, fieldValues] of messages) {
          const eventData: any = {};
          if (fieldValues) {
            for (let i = 0; i < fieldValues.length; i += 2) {
              try {
                eventData[fieldValues[i]] = JSON.parse(fieldValues[i + 1]);
              } catch {
                eventData[fieldValues[i]] = fieldValues[i + 1];
              }
            }
          }

          const startTime = new Date();
          
          const event = await prisma.event.create({
            data: {
              workflowId: workflow.id,
              externalEventId: `redis_${messageId}`,
              headers: { source: 'redis-stream' },
              payload: eventData,
              receivedAt: startTime
            }
          });

          // Hand off to the worker queue (same path as webhooks and schedules) so
          // the run gets retries, live telemetry and saved email connections.
          const execution = await prisma.execution.create({
            data: {
              workflowVersionId: version.id,
              eventId: event.id,
              status: 'queued',
              startedAt: startTime
            }
          });

          await workflowQueue.add('execute', {
            executionId: execution.id,
            workflowVersionId: version.id,
            eventId: event.id,
            payload: eventData
          }, {
            attempts: 4,
            backoff: { type: 'exponential', delay: 2000 }
          });

          // Acknowledge message
          await state.redis.xack(topic, group, messageId);
          console.log(`[Redis] Workflow '${workflow.name}' queued message ${messageId}`);
        }
      }
    } catch (err) {
      if (state.running) {
        console.error(`[Redis] Error consuming for workflow '${workflow.name}':`, err);
        // Wait a bit before retrying on error
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
}
