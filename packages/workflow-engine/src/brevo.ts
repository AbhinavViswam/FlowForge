// Brevo transactional email over HTTPS. Used where SMTP ports are blocked (for
// example Render's free plan). Docs: https://developers.brevo.com/reference/sendtransacemail
//
// The sender must be a sender address verified in the Brevo account.

const BREVO_API = 'https://api.brevo.com/v3';

/** "Name <a@b.com>" or "a@b.com" -> { email, name } */
export function parseAddress(value: string): { email: string; name?: string } {
  const text = String(value || '').trim();
  const match = text.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) return match[1] ? { email: match[2].trim(), name: match[1].trim() } : { email: match[2].trim() };
  return { email: text };
}

export type BrevoEmail = {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  text?: string;
  html?: string;
  timeoutMs?: number;
};

export async function sendBrevoEmail(mail: BrevoEmail): Promise<{ messageId: string | null }> {
  if (!mail.from) throw new Error('Set a sender address (one verified in your Brevo account) to send with Brevo');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), mail.timeoutMs || 10_000);
  try {
    const res = await fetch(`${BREVO_API}/smtp/email`, {
      method: 'POST',
      headers: { 'api-key': mail.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: parseAddress(mail.from),
        to: mail.to.map((email) => ({ email })),
        subject: mail.subject,
        // Brevo needs at least one of these.
        ...(mail.html ? { htmlContent: mail.html } : {}),
        ...(mail.text || !mail.html ? { textContent: mail.text || mail.subject } : {}),
      }),
      signal: controller.signal,
    });
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = body?.message || `HTTP ${res.status}`;
      if (res.status === 401) throw new Error(`Brevo rejected the API key: ${detail}`);
      throw new Error(`Brevo could not send the email: ${detail}`);
    }
    return { messageId: body?.messageId || null };
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error('Brevo did not answer in time');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Check an API key works (used at startup and when saving a connection). */
export async function checkBrevoKey(apiKey: string): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await fetch(`${BREVO_API}/account`, { headers: { 'api-key': apiKey, Accept: 'application/json' } });
    if (res.ok) return { ok: true, message: 'Brevo API key works' };
    const body: any = await res.json().catch(() => ({}));
    return { ok: false, message: `Brevo rejected the API key (${body?.message || 'HTTP ' + res.status})` };
  } catch (err: any) {
    return { ok: false, message: `Could not reach Brevo: ${err.message}` };
  }
}
