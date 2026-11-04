import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { executeWorkflow, parseAddress } from '@flowforge/workflow-engine'
import { sendSystemEmail, verifyMailConfig } from '../mailer'

// Brevo sends over HTTPS (Render's free plan blocks SMTP). Brevo's API is faked
// here, so nothing is really sent.

const ENV = ['BREVO_API_KEY', 'EMAIL_FROM', 'GMAIL_USER', 'GMAIL_APP_PASSWORD', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'RESEND_API_KEY']
const saved: Record<string, string | undefined> = {}
let calls: Array<{ url: string; init: any }> = []

beforeEach(() => {
  for (const k of ENV) { saved[k] = process.env[k]; delete process.env[k] }
  calls = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any = {}) => {
    calls.push({ url: String(url), init })
    const key = init.headers?.['api-key']
    if (key !== 'good-key') return new Response(JSON.stringify({ code: 'unauthorized', message: 'Key not found' }), { status: 401 })
    if (String(url).endsWith('/account')) return new Response(JSON.stringify({ email: 'owner@example.com' }), { status: 200 })
    return new Response(JSON.stringify({ messageId: '<abc@smtp-relay.brevo.com>' }), { status: 201 })
  }))
})
afterEach(() => {
  vi.unstubAllGlobals()
  for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
})

const body = () => JSON.parse(calls[calls.length - 1].init.body)

describe('parseAddress', () => {
  it('reads plain and named addresses', () => {
    expect(parseAddress('a@b.co')).toEqual({ email: 'a@b.co' })
    expect(parseAddress('FlowForge <hello@b.co>')).toEqual({ email: 'hello@b.co', name: 'FlowForge' })
    expect(parseAddress('"Team X" <x@b.co>')).toEqual({ email: 'x@b.co', name: 'Team X' })
  })
})

describe('account emails via Brevo', () => {
  it('sends with the server key and sender', async () => {
    process.env.BREVO_API_KEY = 'good-key'
    process.env.EMAIL_FROM = 'FlowForge <hello@example.com>'
    process.env.GMAIL_USER = 'ignored@gmail.com' // Brevo wins when its key is set
    process.env.GMAIL_APP_PASSWORD = 'x'
    const res = await sendSystemEmail({ to: 'new@example.com', subject: 'Confirm your email — FlowForge', text: 'code 123456', html: '<b>123456</b>' })
    expect(res.provider).toBe('brevo')
    expect(calls[0].url).toBe('https://api.brevo.com/v3/smtp/email')
    expect(body()).toMatchObject({
      sender: { email: 'hello@example.com', name: 'FlowForge' },
      to: [{ email: 'new@example.com' }],
      subject: 'Confirm your email — FlowForge',
      htmlContent: '<b>123456</b>',
      textContent: 'code 123456',
    })
  })

  it('reports a bad key or a missing sender at startup', async () => {
    process.env.BREVO_API_KEY = 'good-key'
    expect((await verifyMailConfig()).message).toMatch(/EMAIL_FROM is empty/)
    process.env.EMAIL_FROM = 'hello@example.com'
    expect(await verifyMailConfig()).toMatchObject({ ok: true })
    process.env.BREVO_API_KEY = 'bad-key'
    const bad = await verifyMailConfig()
    expect(bad.ok).toBe(false)
    expect(bad.message).toMatch(/rejected the API key/)
  })

  it('fails loudly when Brevo refuses', async () => {
    process.env.BREVO_API_KEY = 'bad-key'
    process.env.EMAIL_FROM = 'hello@example.com'
    await expect(sendSystemEmail({ to: 'a@example.com', subject: 's', text: 't' })).rejects.toThrow(/rejected the API key/)
  })
})

describe('Email step via Brevo', () => {
  const flow = (config: Record<string, any>) => ({
    nodes: [{ id: 't', type: 'trigger', config: {} }, { id: 'e', type: 'action', config: { actionType: 'email', subject: 'Hi {{name}}', emailBody: '<p>Hello {{name}}</p>', ...config } }],
    edges: [{ source: 't', target: 'e' }],
  } as any)

  it("uses a user's saved Brevo connection", async () => {
    const res = await executeWorkflow(flow({ toAddress: 'a@example.com, b@example.com', connectionId: 'c1' }), { name: 'Sam' }, undefined, undefined, undefined, {
      connections: { c1: { provider: 'brevo', host: '', port: 0, secure: true, user: '', pass: 'good-key', from: 'Shop <shop@example.com>' } },
    })
    expect(res.nodeResults.e.status).toBe('completed')
    expect(res.nodeResults.e.output.e).toMatchObject({ sent: true, provider: 'brevo', id: '<abc@smtp-relay.brevo.com>' })
    expect(body()).toMatchObject({
      sender: { email: 'shop@example.com', name: 'Shop' },
      to: [{ email: 'a@example.com' }, { email: 'b@example.com' }],
      subject: 'Hi Sam',
      htmlContent: '<p>Hello Sam</p>',
    })
  })

  it('falls back to the server Brevo key', async () => {
    process.env.BREVO_API_KEY = 'good-key'
    process.env.EMAIL_FROM = 'hello@example.com'
    const res = await executeWorkflow(flow({ toAddress: 'a@example.com' }), { name: 'Sam' })
    expect(res.nodeResults.e.status).toBe('completed')
    expect(body().sender).toEqual({ email: 'hello@example.com' })
  })

  it('asks for a sender when none is set', async () => {
    process.env.BREVO_API_KEY = 'good-key'
    const res = await executeWorkflow(flow({ toAddress: 'a@example.com' }), { name: 'Sam' })
    expect(res.nodeResults.e.status).toBe('failed')
    expect(res.nodeResults.e.error).toMatch(/sender address/)
    expect(calls).toHaveLength(0)
  })
})
