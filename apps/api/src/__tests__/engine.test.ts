import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { executeWorkflow } from '@flowforge/workflow-engine'

// How automations run: condition branches, data placeholders, and the checks
// on the email and "Save to database" steps.

const MAIL_VARS = ['GMAIL_USER', 'GMAIL_APP_PASSWORD', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'RESEND_API_KEY']
const saved: Record<string, string | undefined> = {}
beforeEach(() => {
  // No mail settings, so email steps run in simulation and send nothing.
  for (const k of [...MAIL_VARS, 'DATABASE_URL']) { saved[k] = process.env[k]; delete process.env[k] }
})
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
})

const email = (to = 'team@example.com') => ({ actionType: 'email', toAddress: to, subject: 'Order {{order.id}}', emailBody: 'Hi {{customer.name}}' })

function branchingFlow(condition: Record<string, any>) {
  return {
    nodes: [
      { id: 'trigger', type: 'trigger', config: {} },
      { id: 'check', type: 'logic', config: condition },
      { id: 'yes', type: 'action', config: email() },
      { id: 'no', type: 'action', config: email() },
    ],
    edges: [
      { source: 'trigger', target: 'check' },
      { source: 'check', target: 'yes', sourceHandle: 'true' },
      { source: 'check', target: 'no', sourceHandle: 'false' },
    ],
  } as any
}

const payload = { order: { id: 'A-1' }, customer: { name: 'Sam' }, amount: { usd: 20, inr: 1700 } }
const ran = (res: any, id: string) => res.nodeResults[id]?.status === 'completed'

describe('condition branches', () => {
  it('runs only the "true" branch when the condition holds', async () => {
    const res = await executeWorkflow(branchingFlow({ condition: 'amount.inr > 1000' }), payload)
    expect(res.status).toBe('completed')
    expect(ran(res, 'yes')).toBe(true)
    expect(ran(res, 'no')).toBe(false)
  })

  it('runs only the "false" branch otherwise', async () => {
    const res = await executeWorkflow(branchingFlow({ condition: 'amount.inr > 5000' }), payload)
    expect(ran(res, 'yes')).toBe(false)
    expect(ran(res, 'no')).toBe(true)
  })

  it('supports the structured field / operator / value form', async () => {
    const res = await executeWorkflow(branchingFlow({ field: 'customer.name', operator: 'equals', value: 'Sam' }), payload)
    expect(ran(res, 'yes')).toBe(true)
    expect(ran(res, 'no')).toBe(false)
  })
})

describe('email step', () => {
  const run = (config: Record<string, any>) => executeWorkflow({
    nodes: [{ id: 't', type: 'trigger', config: {} }, { id: 'e', type: 'action', config }],
    edges: [{ source: 't', target: 'e' }],
  } as any, payload)

  it('fills in {{placeholders}} from the event', async () => {
    const res = await run(email('{{customer.name}}@example.com'))
    expect(res.nodeResults.e.status).toBe('completed')
    expect(JSON.stringify(res.nodeResults.e.output)).toContain('Order A-1')
  })

  it('fails clearly when the recipient placeholder is missing from the data', async () => {
    const res = await run(email('{{customer.email}}'))
    expect(res.nodeResults.e.status).toBe('failed')
    expect(res.nodeResults.e.error).toMatch(/customer\.email/)
  })

  it('rejects an invalid address', async () => {
    const res = await run(email('not-an-address'))
    expect(res.nodeResults.e.status).toBe('failed')
  })
})

describe('Save to database step', () => {
  const run = (config: Record<string, any>) => executeWorkflow({
    nodes: [{ id: 't', type: 'trigger', config: {} }, { id: 's', type: 'action', config: { actionType: 'sink', tableName: 'orders', dataMapping: '{"id":"{{order.id}}"}', ...config } }],
    edges: [{ source: 't', target: 's' }],
  } as any, payload)

  it('requires your own connection string', async () => {
    const res = await run({})
    expect(res.nodeResults.s.error).toMatch(/Add your database connection string/)
  })

  it("refuses FlowForge's own database", async () => {
    process.env.DATABASE_URL = 'postgresql://flowforge:pw@db.internal.example:5432/flowforge'
    const res = await run({ pgUri: 'postgres://someone:else@DB.internal.example:5432/flowforge' })
    expect(res.nodeResults.s.error).toMatch(/FlowForge's own database/)
  })

  it('does not allow placeholders in the connection string', async () => {
    const res = await run({ pgUri: 'postgresql://u:p@{{host}}:5432/db' })
    expect(res.nodeResults.s.error).toMatch(/placeholders/)
  })

  it('does not allow socket or ?host= overrides', async () => {
    const res = await run({ pgUri: 'postgresql://u:p@db.example.com:5432/db?host=/var/run/postgresql' })
    expect(res.nodeResults.s.error).toMatch(/normal host name/)
  })
})
