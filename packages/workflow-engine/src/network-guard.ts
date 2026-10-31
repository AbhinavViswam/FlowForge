import dns from 'dns';
import net from 'net';

// Blocks user-configured connections (HTTP step, database step, Redis trigger,
// custom SMTP hosts) from reaching the server's own private network: loopback,
// private LANs, link-local (incl. the 169.254.169.254 cloud metadata service),
// carrier-grade NAT and other non-public ranges. Without this, any user could make
// FlowForge call internal services on their behalf (SSRF).
//
// Local development talks to localhost on purpose, so it can be switched off with
// ALLOW_PRIVATE_NETWORK=true. Never set that on a public deployment.

const blocked = new net.BlockList();
for (const [addr, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) {
  blocked.addSubnet(addr, prefix, 'ipv4');
}
for (const [addr, prefix] of [
  // IPv4-mapped (::ffff:a.b.c.d) and NAT64 (64:ff9b::) addresses are handled in
  // isPrivateAddress: a BlockList rule for ::ffff:0:0/96 would match every IPv4 address.
  ['::', 128], ['::1', 128], ['100::', 64],
  ['2001:db8::', 32], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
] as const) {
  blocked.addSubnet(addr, prefix, 'ipv6');
}

export function privateNetworkAllowed(): boolean {
  return /^(1|true|yes)$/i.test(String(process.env.ALLOW_PRIVATE_NETWORK || '').trim());
}

// For IPv4-mapped (::ffff:7f00:1 or ::ffff:127.0.0.1) and NAT64 (64:ff9b::...)
// addresses, return the IPv4 address inside so it gets the IPv4 rules.
function embeddedIPv4(ip: string): string | null {
  const m = ip.match(/^(?:::ffff:|64:ff9b::)(.+)$/);
  if (!m) return null;
  const rest = m[1];
  if (net.isIPv4(rest)) return rest;
  const parts = rest.split(':');
  if (parts.length !== 2) return null;
  const hi = parseInt(parts[0], 16);
  const lo = parseInt(parts[1], 16);
  if (Number.isNaN(hi) || Number.isNaN(lo)) return null;
  return [hi >> 8, hi & 255, lo >> 8, lo & 255].join('.');
}

/** True for any address that isn't a normal public internet address. */
export function isPrivateAddress(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) return blocked.check(ip, 'ipv4');
  if (family === 6) {
    const lower = ip.toLowerCase();
    const embedded = embeddedIPv4(lower);
    if (embedded) return isPrivateAddress(embedded);
    return blocked.check(ip, 'ipv6');
  }
  return true; // not an IP at all: treat as unsafe
}

const blockedError = (host: string) =>
  new Error(`Connections to private or internal network addresses are not allowed (${host})`);

/**
 * Resolve a hostname and throw if it (or any address it resolves to) is private.
 * Used before connecting to databases, Redis and SMTP servers.
 */
export async function assertPublicHost(hostname: string): Promise<void> {
  if (privateNetworkAllowed()) return;
  const host = String(hostname || '').replace(/^\[|\]$/g, '').trim().toLowerCase();
  if (!host) throw new Error('A host name is required');
  if (host === 'localhost' || host.endsWith('.localhost')) throw blockedError(host);
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw blockedError(host);
    return;
  }
  let addresses: dns.LookupAddress[];
  try {
    addresses = await dns.promises.lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error(`Could not resolve host "${host}"`);
  }
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) throw blockedError(host);
}

// DNS lookup used at connect time by the HTTP client, so a hostname that resolves
// to a public address during the check but a private one when connecting (DNS
// rebinding) is still refused.
function guardedLookup(hostname: string, options: any, callback: (...args: any[]) => void) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses: any) => {
    if (err) return callback(err);
    const list: dns.LookupAddress[] = Array.isArray(addresses) ? addresses : [addresses];
    if (list.length === 0 || list.some((a) => isPrivateAddress(a.address))) return callback(blockedError(hostname));
    if (options && options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

let agent: any = null;
function guardedAgent() {
  if (!agent) {
    const { Agent } = require('undici');
    agent = new Agent({ connect: { lookup: guardedLookup } });
  }
  return agent;
}

/**
 * fetch() for user-supplied URLs. Only http/https, every hop (including redirects)
 * is checked, and the connection itself refuses private addresses.
 */
export async function safeFetch(url: string, init: RequestInit & { method?: string } = {}): Promise<Response> {
  if (privateNetworkAllowed()) return fetch(url, init);
  const { fetch: undiciFetch } = require('undici');
  let current = url;
  let options: any = { ...init };
  for (let hop = 0; hop <= 5; hop++) {
    let parsed: URL;
    try {
      parsed = new URL(current);
    } catch {
      throw new Error(`Invalid URL: ${current}`);
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Only http:// and https:// URLs are allowed');
    }
    await assertPublicHost(parsed.hostname);
    const res = await undiciFetch(current, { ...options, redirect: 'manual', dispatcher: guardedAgent() });
    const location = res.headers.get('location');
    if ([301, 302, 303, 307, 308].includes(res.status) && location) {
      current = new URL(location, current).toString();
      // Browsers switch to GET after 303, and after 301/302 for POST.
      if (res.status === 303 || ((res.status === 301 || res.status === 302) && String(options.method || 'GET').toUpperCase() === 'POST')) {
        options = { ...options, method: 'GET', body: undefined };
      }
      await res.body?.cancel?.().catch(() => {});
      continue;
    }
    return res as unknown as Response;
  }
  throw new Error('Too many redirects (more than 5)');
}
