// Which websites may use the API from a browser.
//
// CORS_ORIGINS: comma-separated list of exact origins allowed to call the API with
// the user's login cookie, e.g. "https://app.example.com,https://example.com".
// In development (NODE_ENV !== 'production') any localhost origin and local
// file:// pages (the webhook tester) are allowed as well.
//
// Public webhook URLs are different: they don't use the login cookie, so any
// website (a customer's form, the webhook tester) may post to them.

const normalize = (origin: string) => origin.trim().replace(/\/+$/, '').toLowerCase();

export function configuredOrigins(): string[] {
  return String(process.env.CORS_ORIGINS || '').split(',').map(normalize).filter(Boolean);
}

const isProduction = () => process.env.NODE_ENV === 'production';

/** True when a browser at `origin` may make logged-in requests to the API. */
export function isAllowedOrigin(origin?: string | null): boolean {
  if (!origin) return true; // same-origin requests and non-browser clients send no Origin
  const o = normalize(origin);
  if (configuredOrigins().includes(o)) return true;
  if (!isProduction()) {
    if (o === 'null') return true; // file:// pages such as the webhook tester
    try {
      const { hostname } = new URL(o);
      return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
    } catch {
      return false;
    }
  }
  return false;
}

/** Public webhook ingestion URLs (no login cookie involved). */
export function isPublicWebhookPath(url: string): boolean {
  return /^\/(api\/v1\/wh|webhooks)\//.test(url);
}

/** Cookie SameSite policy. Use "none" only when the website and API are on different sites. */
export function cookieOptions() {
  const raw = String(process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
  const sameSite = (raw === 'none' || raw === 'strict' ? raw : 'lax') as 'lax' | 'strict' | 'none';
  // Browsers reject SameSite=None cookies that aren't Secure (HTTPS only).
  const secure = isProduction() || sameSite === 'none';
  return { path: '/', httpOnly: true, secure, sameSite };
}
