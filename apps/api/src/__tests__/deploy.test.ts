import { describe, it, expect, afterEach } from 'vitest'
import { executeWorkflow } from '@flowforge/workflow-engine'
import { queueConnectionOptions } from '../queue'
import { isSameHostOrigin, configuredOrigins } from '../origins'

// Settings for running as a single service on Render with a hosted database (Supabase).

const saved = { ...process.env }
afterEach(() => {
  for (const k of ['DATABASE_URL', 'CORS_ORIGINS', 'PUBLIC_URL', 'RENDER_EXTERNAL_URL']) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe('job queue database connection', () => {
  it('drops Prisma-only settings and encrypts without verifying for hosted databases', () => {
    const opts = queueConnectionOptions('postgresql://postgres.abc:pw@aws-0-eu.pooler.supabase.com:5432/postgres?sslmode=require&connection_limit=5&schema=public')
    expect(opts.connectionString).toBe('postgresql://postgres.abc:pw@aws-0-eu.pooler.supabase.com:5432/postgres')
    expect(opts.ssl).toEqual({ rejectUnauthorized: false })
  })

  it('uses no SSL for a local database', () => {
    expect(queueConnectionOptions('postgresql://flowforge:pw@localhost:5433/flowforge?schema=public').ssl).toBeUndefined()
    expect(queueConnectionOptions('postgresql://u:p@db:5432/x?sslmode=disable').ssl).toBeUndefined()
  })
})

describe('website served by the API', () => {
  it('treats pages from this same server as allowed', () => {
    expect(isSameHostOrigin('https://flowforge.onrender.com', 'flowforge.onrender.com')).toBe(true)
    expect(isSameHostOrigin('https://evil.example.net', 'flowforge.onrender.com')).toBe(false)
    expect(isSameHostOrigin(undefined, 'flowforge.onrender.com')).toBe(false)
    expect(isSameHostOrigin('null', 'flowforge.onrender.com')).toBe(false)
  })

  it("includes Render's address and PUBLIC_URL in the allowed list", () => {
    process.env.RENDER_EXTERNAL_URL = 'https://flowforge.onrender.com'
    process.env.PUBLIC_URL = 'https://app.example.com/'
    delete process.env.CORS_ORIGINS
    expect(configuredOrigins()).toEqual(['https://app.example.com', 'https://flowforge.onrender.com'])
  })
})

describe('"Save to database" with a shared hosted pooler', () => {
  // ".invalid" never resolves, so these finish instantly without network access.
  const run = (pgUri: string) => executeWorkflow({
    nodes: [{ id: 't', type: 'trigger', config: {} }, { id: 's', type: 'action', config: { actionType: 'sink', tableName: 'orders', dataMapping: '{"a":"1"}', pgUri } }],
    edges: [{ source: 't', target: 's' }],
  } as any, { a: 1 })

  it("allows another customer's project on the same pooler host", async () => {
    process.env.DATABASE_URL = 'postgresql://postgres.ourproject:pw@pooler.invalid:5432/postgres'
    const res = await run('postgresql://postgres.theirproject:pw@pooler.invalid:5432/postgres')
    expect(res.nodeResults.s.error).not.toMatch(/FlowForge's own database/)
    expect(res.nodeResults.s.error).toMatch(/resolve/)
  })

  it("still refuses FlowForge's own project", async () => {
    process.env.DATABASE_URL = 'postgresql://postgres.ourproject:pw@pooler.invalid:5432/postgres'
    const res = await run('postgresql://POSTGRES.ourproject:other@pooler.invalid:5432/postgres')
    expect(res.nodeResults.s.error).toMatch(/FlowForge's own database/)
    // Another role in the same project is still FlowForge's database.
    const otherRole = await run('postgresql://authenticator.ourproject:x@pooler.invalid:5432/postgres')
    expect(otherRole.nodeResults.s.error).toMatch(/FlowForge's own database/)
  })
})
