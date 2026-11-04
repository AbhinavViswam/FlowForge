// Job queue for workflow runs, stored in Postgres (pg-boss), so FlowForge needs
// no Redis. Webhooks, schedules, Redis-stream triggers and manual retries add a
// job; the runner in jobs/run-execution.ts picks it up. Jobs survive restarts and
// failed runs are retried with growing delays.

export const QUEUE_NAME = 'workflow-execution'

let boss: any = null
let starting: Promise<any> | null = null

/**
 * Connection settings for pg-boss from DATABASE_URL. Query parameters there are
 * meant for Prisma (schema, connection_limit, pgbouncer...) and are dropped.
 * Hosted databases such as Supabase use certificates that Node can't verify
 * by default, so any sslmode other than "disable" means "encrypt, don't verify".
 */
export function queueConnectionOptions(databaseUrl = process.env.DATABASE_URL || '') {
  const url = new URL(databaseUrl)
  const sslmode = url.searchParams.get('sslmode')
  url.search = ''
  return {
    connectionString: url.toString(),
    ssl: sslmode && sslmode !== 'disable' ? { rejectUnauthorized: false } : undefined,
  }
}

/** Start the queue once (creates its tables in a "pgboss" schema on first run). */
export function startQueue(): Promise<any> {
  if (boss) return Promise.resolve(boss)
  if (!starting) {
    starting = (async () => {
      // pg-boss is an ES module; Node 22 can require() it directly.
      const { PgBoss } = require('pg-boss')
      const instance = new PgBoss({
        ...queueConnectionOptions(),
        // Small pool: free database plans allow only a few connections.
        max: Number(process.env.QUEUE_DB_POOL_SIZE) || 3,
        // Poll instead of LISTEN/NOTIFY so it works through connection poolers.
        useListenNotify: false,
        application_name: 'flowforge-queue',
      })
      instance.on('error', (err: Error) => console.error('[Queue]', err.message))
      await instance.start()
      if (!(await instance.getQueue(QUEUE_NAME))) {
        await instance.createQueue(QUEUE_NAME, { expireInSeconds: 15 * 60 })
      }
      boss = instance
      return instance
    })().catch((err) => {
      starting = null
      throw err
    })
  }
  return starting
}

export async function stopQueue() {
  if (!boss) return
  const instance = boss
  boss = null
  starting = null
  await instance.stop({ graceful: true, timeout: 20_000 })
}

type AddOptions = { attempts?: number; backoff?: { type?: string; delay?: number } }

/** Add a run to the queue. `attempts` counts the first try, like before. */
export const workflowQueue = {
  async add(_name: string, data: object, options: AddOptions = {}) {
    const instance = await startQueue()
    return instance.send(QUEUE_NAME, data, {
      retryLimit: Math.max(0, (options.attempts ?? 1) - 1),
      retryDelay: Math.max(1, Math.round((options.backoff?.delay ?? 2000) / 1000)),
      retryBackoff: options.backoff?.type === 'exponential',
    })
  },
}
