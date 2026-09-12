import Redis from 'ioredis';
import { prisma } from '../db';
import { executeWorkflow } from '@flowforge/workflow-engine';

// Keep track of active consumers
const activeConsumers = new Map<string, { redis: Redis, running: boolean }>();

export async function initializeRedisConsumers() {
  console.log('Initializing Redis Stream Consumers...');
  await refreshRedisConsumers();

  // Poll for changes every minute
  setInterval(refreshRedisConsumers, 60000);
}

async function refreshRedisConsumers() {
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

    const redisUri = config.redisUri;
    const redisTopic = config.redisTopic || 'events';
    const consumerGroup = config.redisConsumerGroup || 'flowforge-workers';
    const consumerName = `worker-${process.pid}`;
    
    if (!redisUri) continue; // Skip if no connection URI provided

    const consumerKey = `${workflow.id}_${version.id}_${redisTopic}_${consumerGroup}`;
    currentConsumerIds.add(consumerKey);

    if (!activeConsumers.has(consumerKey)) {
      console.log(`[Redis] Starting consumer for workflow '${workflow.name}' on stream '${redisTopic}'`);
      
      try {
        const redis = new Redis(redisUri);
        
        // Ensure consumer group exists
        try {
          await redis.xgroup('CREATE', redisTopic, consumerGroup, '$', 'MKSTREAM');
        } catch (err: any) {
          if (!err.message.includes('BUSYGROUP')) {
            console.error(`[Redis] Failed to create group: ${err.message}`);
          }
        }

        const state = { redis, running: true };
        activeConsumers.set(consumerKey, state);

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
      state.redis.quit();
      activeConsumers.delete(key);
    }
  }
}

async function consumeLoop(workflow: any, version: any, definition: any, state: { redis: Redis, running: boolean }, topic: string, group: string, name: string) {
  while (state.running) {
    try {
      const results = await (state.redis as any).xreadgroup('GROUP', group, name, 'BLOCK', 5000, 'COUNT', 1, 'STREAMS', topic, '>');
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

          const result = await executeWorkflow(definition, eventData);
          
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

          // Acknowledge message
          await state.redis.xack(topic, group, messageId);
          console.log(`[Redis] Workflow '${workflow.name}' processed message ${messageId} with status: ${result.status}`);
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
