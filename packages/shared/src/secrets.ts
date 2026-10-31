// Startup check for secrets. In production the API and worker refuse to start
// with a missing, short or placeholder secret, so a deployment can never run
// with values copied from the repo (anyone could forge logins or decrypt data).

// Values that appear in this repo's docs/examples or are obviously placeholders.
const PLACEHOLDER = /change[-_ ]?me|change[-_ ]?in[-_ ]?prod|super-?secret|^secret$|^password$|example|placeholder|your[-_ ]?(secret|key)/i;
const WEAK_DB_PASSWORDS = new Set(['', 'password', 'flowforge_password', 'postgres', 'admin', 'root', 'flowforge', '123456']);

function secretProblem(name: string, value: string | undefined, minLength: number): string | null {
  if (!value) return `${name} is not set`;
  if (value.length < minLength) return `${name} is too short (${value.length} characters, need at least ${minLength})`;
  if (PLACEHOLDER.test(value)) return `${name} is a placeholder value`;
  return null;
}

function databaseProblem(url: string | undefined): string | null {
  if (!url) return 'DATABASE_URL is not set';
  try {
    const password = decodeURIComponent(new URL(url).password);
    if (WEAK_DB_PASSWORDS.has(password.toLowerCase())) return 'DATABASE_URL uses a default or empty database password';
  } catch {
    return 'DATABASE_URL is not a valid URL';
  }
  return null;
}

/** Problems with the secrets a service needs. Empty array = all good. */
export function findSecretProblems(service: 'api' | 'worker', env: Record<string, string | undefined>): string[] {
  const problems = [
    service === 'api' ? secretProblem('JWT_SECRET', env.JWT_SECRET, 32) : null,
    secretProblem('ENCRYPTION_KEY', env.ENCRYPTION_KEY, 32),
    databaseProblem(env.DATABASE_URL),
  ];
  return problems.filter((p): p is string => p !== null);
}

/**
 * Startup verdict: in production any problem is fatal (the caller should exit);
 * in development problems are only a warning so local setups keep working.
 */
export function checkSecretsAtStartup(
  service: 'api' | 'worker',
  env: Record<string, string | undefined>,
  production: boolean,
): { fatal: boolean; message: string | null } {
  const problems = findSecretProblems(service, env);
  if (problems.length === 0) return { fatal: false, message: null };
  const list = problems.map((p) => `  - ${p}`).join('\n');
  if (!production) return { fatal: false, message: `[Startup] Insecure settings (allowed in development only):\n${list}` };
  return {
    fatal: true,
    message: `[Startup] Refusing to start the ${service} in production:\n${list}\n` +
      `Generate a value with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
  };
}
