import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertCircle, ArrowLeft, ArrowRight, Eye, EyeOff, KeyRound } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import Logo from '../components/Logo';
import { Button, Input, Field } from '../components/ui';

const errorText = (err: any, fallback: string) =>
  err?.response?.data?.error || err?.response?.data?.message || fallback;

// Forgot password: step 1 asks for the email and sends a 6-digit code; step 2
// takes the code and a new password, then signs the user in.
export default function ForgotPassword() {
  const { forgotPassword, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => { if (sentTo) codeRef.current?.focus(); }, [sentTo]);

  const sendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError('Enter a valid email address.'); return; }
    setBusy(true);
    setError('');
    try {
      const res = await forgotPassword(email.trim());
      setSentTo(res.email);
      setCooldown(res.cooldownSeconds);
      setNotice('');
    } catch (err: any) {
      setError(errorText(err, 'Could not send the code'));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!sentTo || cooldown > 0) return;
    setResending(true);
    setError('');
    try {
      const res = await forgotPassword(sentTo);
      setCooldown(res.cooldownSeconds);
      setCode('');
      setNotice('A new code is on its way.');
    } catch (err: any) {
      setError(errorText(err, 'Could not send a new code'));
    } finally {
      setResending(false);
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sentTo) return;
    if (code.length !== 6) { setError('Enter the 6-digit code from the email.'); return; }
    if (password.length < 8) { setError('Your new password must be at least 8 characters long.'); return; }
    setBusy(true);
    setError('');
    try {
      await resetPassword(sentTo, code, password);
    } catch (err: any) {
      setError(errorText(err, 'Could not reset your password'));
    } finally {
      setBusy(false);
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
          <h1 className="mt-6 text-2xl font-display font-bold text-ink">{sentTo ? 'Choose a new password' : 'Reset your password'}</h1>
          <p className="mt-1.5 text-sm text-muted">
            {sentTo
              ? <>If <b className="text-ink">{sentTo}</b> has an account, we sent it a 6-digit code.</>
              : "Enter your account's email and we'll send you a code."}
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface shadow-card p-6 sm:p-7">
          {sentTo ? (
            <form className="flex flex-col gap-5" onSubmit={submitReset}>
              <div className="flex justify-center">
                <div className="w-12 h-12 rounded-xl bg-accent-soft text-accent grid place-items-center"><KeyRound size={22} /></div>
              </div>
              {errorBox}
              {notice && !error && <div className="text-center text-sm text-ok">{notice}</div>}

              <Field label="Code from the email" hint="The code expires in 10 minutes.">
                <Input
                  ref={codeRef}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  maxLength={6}
                  className="h-14 text-center text-2xl font-mono tracking-[0.5em]"
                />
              </Field>

              <Field label="New password" hint="At least 8 characters. You'll be signed out on other devices.">
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Choose a new password"
                    className="pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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

              <Button type="submit" loading={busy} className="w-full">
                {busy ? 'Saving…' : 'Set new password and sign in'}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <button type="button" onClick={() => { setSentTo(null); setError(''); setNotice(''); setCode(''); }}
                  className="inline-flex items-center gap-1 text-muted hover:text-ink">
                  <ArrowLeft size={14} /> Use a different email
                </button>
                <button type="button" onClick={resend} disabled={cooldown > 0 || resending}
                  className="font-medium text-accent hover:underline disabled:text-faint disabled:no-underline disabled:cursor-not-allowed">
                  {resending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </button>
              </div>
              <p className="text-center text-xs text-faint">Can't find it? Check your spam folder.</p>
            </form>
          ) : (
            <form className="flex flex-col gap-5" onSubmit={sendCode}>
              {errorBox}
              <Field label="Email">
                <Input type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
              </Field>
              <Button type="submit" loading={busy} className="w-full group">
                {busy ? 'Sending code…' : 'Send code'}
                {!busy && <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />}
              </Button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          Remembered it?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
