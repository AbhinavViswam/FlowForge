// Send a test email with the API's sign-up email settings (from apps/api/.env).
//
//   npm run mail:test -w @flowforge/api -- you@example.com
//
// Sets process.exitCode rather than exiting immediately: exiting while a network
// socket is still closing crashes Node on Windows.
import 'dotenv/config';
import { getMailConfig, sendSystemEmail, verifyMailConfig } from '../src/mailer';

async function main(): Promise<boolean> {
  const to = process.argv[2];
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.error('Usage: npm run mail:test -w @flowforge/api -- you@example.com');
    return false;
  }

  const config = getMailConfig();
  console.log(`Provider: ${config.kind === 'none' ? 'none configured' : `${config.kind}, from ${config.from}`}`);

  const check = await verifyMailConfig();
  console.log(`${check.ok ? 'OK ' : 'ERR'} ${check.message}`);
  if (!check.ok || config.kind === 'none') return false;

  const result = await sendSystemEmail({
    to,
    subject: 'FlowForge test email',
    text: 'This is a test email from FlowForge. If you received it, sign-up confirmation emails will work.',
  });
  console.log(`Sent to ${to} via ${result.provider}. Check the inbox (and spam folder).`);
  return true;
}

main()
  .then((ok) => { if (!ok) process.exitCode = 1; })
  .catch((err) => {
    console.error(`Sending failed: ${err.message}`);
    process.exitCode = 1;
  });
