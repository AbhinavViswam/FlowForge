import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { registerSchema, type RegisterInput } from '@flowforge/shared/src/schemas/auth';
import { ArrowRight, AlertCircle, Eye, EyeOff, Check, MailCheck, ArrowLeft } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import Logo from '../components/Logo';
import { Button, Input, Field } from '../components/ui';

const perks = [
  'Connect a trigger to actions in minutes',
  'Test runs with live step-by-step results',
  'No credit card required',
];

const errorText = (err: any, fallback: string) =>
  err?.response?.data?.error || err?.response?.data?.message || fallback;

export default function Signup() {
  const { register: registerUser, verifyEmail, resendCode } = useAuth();
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step 2 state: the email we sent a code to, the typed code, and the resend timer.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [notice, setNotice] = useState('');
  const codeRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => { if (pendingEmail) codeRef.current?.focus(); }, [pendingEmail]);

  const onSubmit = async (data: RegisterInput) => {
    try {
      setError('');
      const res = await registerUser(data);
      if (!res.pending) return; // account created and signed in
      setPendingEmail(res.email);
      setCooldown(res.cooldownSeconds);
      setCode('');
      setNotice('');
    } catch (err: any) {
      setError(errorText(err, 'Could not create your account'));
    }
  };

  const submitCode = async (value = code) => {
    if (!pendingEmail || value.length !== 6) return;
    setVerifying(true);
    setError('');
    try {
      await verifyEmail(pendingEmail, value);
    } catch (err: any) {
      setError(errorText(err, 'Could not verify the code'));
      setCode('');
      codeRef.current?.focus();
    } finally {
      setVerifying(false);
    }
  };

  const onCodeChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    if (digits.length === 6) submitCode(digits); // submit as soon as the 6th digit lands
  };

  const onResend = async () => {
    if (!pendingEmail || cooldown > 0) return;
    setResending(true);
    setError('');
    try {
      const res = await resendCode(pendingEmail);
      setCooldown(res.cooldownSeconds);
      setCode('');
      setNotice('A new code is on its way.');
    } catch (err: any) {
      const wait = Number(err?.response?.data?.cooldownSeconds);
      if (wait) setCooldown(wait);
      setError(errorText(err, 'Could not send a new code'));
    } finally {
      setResending(false);
    }
  };

  const errorBox = error && (
    <div className="flex items-center gap-2 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2.5 text-sm text-danger">
      <AlertCircle size={16} className="shrink-0" />
      <span>{error}</span>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>

      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <Link to="/"><Logo size="lg" /></Link>
          <h1 className="mt-6 text-2xl font-display font-bold text-ink">{pendingEmail ? 'Check your email' : 'Create your account'}</h1>
          <p className="mt-1.5 text-sm text-muted">
            {pendingEmail
              ? <>We sent a 6-digit code to <b className="text-ink">{pendingEmail}</b>.</>
              : 'Start automating your workflows for free.'}
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface shadow-card p-6 sm:p-7">
          {pendingEmail ? (
            <form className="flex flex-col gap-5" onSubmit={(e) => { e.preventDefault(); submitCode(); }}>
              <div className="flex justify-center">
                <div className="w-12 h-12 rounded-xl bg-accent-soft text-accent grid place-items-center"><MailCheck size={22} /></div>
              </div>
              {errorBox}
              {notice && !error && <div className="text-center text-sm text-ok">{notice}</div>}

              <Field label="Confirmation code" hint="The code expires in 10 minutes.">
                <Input
                  ref={codeRef}
                  value={code}
                  onChange={(e) => onCodeChange(e.target.value)}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  className="h-14 text-center text-2xl font-mono tracking-[0.5em]"
                  disabled={verifying}
                />
              </Field>

              <Button type="submit" loading={verifying} disabled={code.length !== 6} className="w-full">
                {verifying ? 'Verifying…' : 'Verify and create account'}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={() => { setPendingEmail(null); setError(''); setNotice(''); }}
                  className="inline-flex items-center gap-1 text-muted hover:text-ink">
                  <ArrowLeft size={14} /> Use a different email
                </button>
                <button type="button" onClick={onResend} disabled={cooldown > 0 || resending}
                  className="font-medium text-accent hover:underline disabled:text-faint disabled:no-underline disabled:cursor-not-allowed">
                  {resending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </button>
              </div>
              <p className="text-center text-xs text-faint">Can't find it? Check your spam folder.</p>
            </form>
          ) : (
            <>
              <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)}>
                {errorBox}

                <Field label="Email" error={errors.email?.message}>
                  <Input type="email" autoComplete="email" placeholder="you@company.com" {...register('email')} />
                </Field>

                <Field label="Password" hint="At least 8 characters." error={errors.password?.message}>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Create a password"
                      className="pr-10"
                      {...register('password')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-faint hover:text-ink transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </Field>

                <Button type="submit" loading={isSubmitting} className="w-full group">
                  {isSubmitting ? 'Creating account…' : 'Create account'}
                  {!isSubmitting && <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />}
                </Button>
              </form>

              <ul className="mt-5 pt-5 border-t border-line flex flex-col gap-2">
                {perks.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-[13px] text-muted">
                    <Check size={15} className="text-ok shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
