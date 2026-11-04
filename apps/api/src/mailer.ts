// System email (account emails such as sign-up codes), separate from the
// per-user connections that automations send through.
//
// Provider order: Brevo (BREVO_API_KEY) -> SMTP/Gmail (SMTP_* or GMAIL_* env) -> Resend
// (RESEND_API_KEY). Brevo and Resend send over HTTPS, so they also work on hosts
// that block SMTP ports (such as Render's free plan).
// With neither configured, development prints the email to the server log and
// production refuses to send (so sign-ups fail loudly instead of silently).

import { sendBrevoEmail, checkBrevoKey } from '@flowforge/workflow-engine';

type SystemEmail = { to: string; subject: string; text: string; html?: string };
export type SendResult = { delivered: boolean; provider: 'brevo' | 'smtp' | 'resend' | 'log' };

type SmtpConfig = { host: string; port: number; secure: boolean; user: string; pass: string };
export type MailConfig =
  | { kind: 'brevo'; from: string; apiKey: string }
  | { kind: 'smtp'; from: string; smtp: SmtpConfig }
  | { kind: 'resend'; from: string; apiKey: string }
  | { kind: 'none' };

const isProduction = () => process.env.NODE_ENV === 'production';

export function getMailConfig(): MailConfig {
  if (process.env.BREVO_API_KEY) {
    return { kind: 'brevo', from: process.env.EMAIL_FROM || '', apiKey: process.env.BREVO_API_KEY };
  }
  const host = process.env.SMTP_HOST || (process.env.GMAIL_USER ? 'smtp.gmail.com' : '');
  const user = process.env.SMTP_USER || process.env.GMAIL_USER || '';
  // App Passwords are shown grouped as "abcd efgh ijkl mnop"; strip the spaces.
  const pass = (process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  if (host && user && pass) {
    const envSecure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
    const port = parseInt(process.env.SMTP_PORT || '', 10) || (envSecure ? 465 : 587);
    const secure = process.env.SMTP_SECURE ? envSecure : port === 465;
    return { kind: 'smtp', from: process.env.EMAIL_FROM || user, smtp: { host, port, secure, user, pass } };
  }
  if (process.env.RESEND_API_KEY) {
    return { kind: 'resend', from: process.env.EMAIL_FROM || 'onboarding@resend.dev', apiKey: process.env.RESEND_API_KEY };
  }
  return { kind: 'none' };
}

function smtpTransport(smtp: SmtpConfig) {
  const nodemailer = require('nodemailer');
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });
}

export async function sendSystemEmail(mail: SystemEmail): Promise<SendResult> {
  const config = getMailConfig();

  if (config.kind === 'brevo') {
    await sendBrevoEmail({ apiKey: config.apiKey, from: config.from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html });
    return { delivered: true, provider: 'brevo' };
  }

  if (config.kind === 'smtp') {
    await smtpTransport(config.smtp).sendMail({ from: config.from, to: mail.to, subject: mail.subject, text: mail.text, html: mail.html });
    return { delivered: true, provider: 'smtp' };
  }

  if (config.kind === 'resend') {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
    });
    if (!res.ok) throw new Error(`Resend error: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    return { delivered: true, provider: 'resend' };
  }

  if (isProduction()) {
    throw new Error('No email provider configured (set BREVO_API_KEY + EMAIL_FROM, GMAIL_USER/GMAIL_APP_PASSWORD, SMTP_* or RESEND_API_KEY)');
  }
  // Development only: print it so sign-up can still be tested locally.
  console.log(
    `\n[Mailer] No email provider configured (set BREVO_API_KEY + EMAIL_FROM, GMAIL_USER/GMAIL_APP_PASSWORD, SMTP_* or RESEND_API_KEY).\n` +
    `[Mailer] To: ${mail.to}\n[Mailer] Subject: ${mail.subject}\n[Mailer] ${mail.text}\n`
  );
  return { delivered: false, provider: 'log' };
}

/**
 * Check the configured provider can actually send (logs in to SMTP, or checks
 * the Resend key). Returns a human-readable status line; never throws.
 */
export async function verifyMailConfig(): Promise<{ ok: boolean; message: string }> {
  const config = getMailConfig();
  if (config.kind === 'none') {
    return isProduction()
      ? { ok: false, message: 'No email provider configured. Sign-ups WILL FAIL: set BREVO_API_KEY + EMAIL_FROM, GMAIL_USER/GMAIL_APP_PASSWORD, SMTP_* or RESEND_API_KEY.' }
      : { ok: true, message: 'No email provider configured: sign-up codes will be printed in this log (development only).' };
  }
  if (config.kind === 'brevo') {
    if (!config.from) return { ok: false, message: 'BREVO_API_KEY is set but EMAIL_FROM is empty: set it to a sender verified in Brevo. Sign-ups WILL FAIL.' };
    const check = await checkBrevoKey(config.apiKey);
    return check.ok
      ? { ok: true, message: `Sign-up emails will be sent via Brevo as ${config.from}.` }
      : { ok: false, message: `${check.message}. Sign-ups WILL FAIL.` };
  }
  if (config.kind === 'smtp') {
    try {
      await smtpTransport(config.smtp).verify();
      return { ok: true, message: `Sign-up emails will be sent via SMTP ${config.smtp.host} as ${config.from}.` };
    } catch (err: any) {
      return { ok: false, message: `SMTP login to ${config.smtp.host} as ${config.smtp.user} FAILED: ${String(err.message).split('\n')[0]}` };
    }
  }
  try {
    const res = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${config.apiKey}` } });
    // Resend answers an invalid key with 400 "API key is invalid" (or 401). A
    // sending-only key gets 403 here but can still send, so 403 is fine.
    if (res.status === 400 || res.status === 401) {
      const body = await res.text().catch(() => '');
      return { ok: false, message: `Resend API key was rejected: ${body.slice(0, 120) || 'HTTP ' + res.status}` };
    }
    return { ok: true, message: `Sign-up emails will be sent via Resend as ${config.from}.` };
  } catch (err: any) {
    return { ok: false, message: `Could not reach Resend: ${err.message}` };
  }
}
