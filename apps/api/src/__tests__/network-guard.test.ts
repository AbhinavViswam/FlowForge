import { describe, it, expect, afterEach } from 'vitest'
import { isPrivateAddress, assertPublicHost, safeFetch, executeWorkflow } from '@flowforge/workflow-engine'

// User-configured steps must not reach the server's own network (SSRF).
// These checks use IP literals and "localhost" only, so no DNS or internet is needed.

afterEach(() => { delete process.env.ALLOW_PRIVATE_NETWORK })

describe('isPrivateAddress', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '::1', '::', 'fe80::1', 'fc00::1', '::ffff:127.0.0.1', '::ffff:7f00:1',
    '64:ff9b::10.0.0.1', 'not-an-ip',
  ])('blocks %s', (ip) => expect(isPrivateAddress(ip)).toBe(true))

  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '93.184.215.14', '2606:4700:4700::1111', '::ffff:8.8.8.8'])(
    'allows %s', (ip) => expect(isPrivateAddress(ip)).toBe(false),
  )
})

describe('assertPublicHost', () => {
  it.each(['localhost', 'api.localhost', '127.0.0.1', '[::1]', '10.0.0.5'])('refuses %s', async (host) => {
    await expect(assertPublicHost(host)).rejects.toThrow(/private or internal/)
  })

  it('accepts a public IP', async () => {
    await expect(assertPublicHost('8.8.8.8')).resolves.toBeUndefined()
  })

  it('can be switched off for local development', async () => {
    process.env.ALLOW_PRIVATE_NETWORK = 'true'
    await expect(assertPublicHost('127.0.0.1')).resolves.toBeUndefined()
  })
})

describe('safeFetch', () => {
  it('only allows http and https', async () => {
    await expect(safeFetch('file:///etc/passwd')).rejects.toThrow(/Only http/)
    await expect(safeFetch('ftp://example.com/')).rejects.toThrow(/Only http/)
  })

  it('refuses private addresses before connecting', async () => {
    await expect(safeFetch('http://127.0.0.1:1/')).rejects.toThrow(/private or internal/)
    await expect(safeFetch('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(/private or internal/)
  })
})

describe('workflow steps', () => {
  const run = (config: Record<string, any>) => executeWorkflow({
    nodes: [
      { id: 't1', type: 'trigger', config: {} },
      { id: 'a1', type: 'action', config },
    ],
    edges: [{ source: 't1', target: 'a1' }],
  } as any, { hello: 'world' })

  it('HTTP step cannot call the server itself', async () => {
    const res = await run({ actionType: 'http', method: 'GET', url: 'http://localhost:3000/' })
    expect(res.nodeResults.a1.status).toBe('failed')
    expect(res.nodeResults.a1.error).toMatch(/private or internal/)
  })

  it('database step cannot reach a private host', async () => {
    const res = await run({ actionType: 'sink', tableName: 't', dataMapping: '{"a":"1"}', pgUri: 'postgresql://u:p@10.0.0.5:5432/db' })
    expect(res.nodeResults.a1.status).toBe('failed')
    expect(res.nodeResults.a1.error).toMatch(/private or internal/)
  })
})
