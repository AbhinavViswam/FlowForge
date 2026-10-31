import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginSchema, type LoginInput } from '@flowforge/shared/src/schemas/auth';
import { ArrowRight, AlertCircle, Eye, EyeOff } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import Logo from '../components/Logo';
import { Button, Input, Field } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    try {
      setError('');
      await login(data);
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Invalid email or password');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>

      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
          <Link to="/"><Logo size="lg" /></Link>
          <h1 className="mt-6 text-2xl font-display font-bold text-ink">Welcome back</h1>
          <p className="mt-1.5 text-sm text-muted">Sign in to build and run your automations.</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface shadow-card p-6 sm:p-7">
          <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)}>
            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-danger/25 bg-danger/10 px-3 py-2.5 text-sm text-danger">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Field label="Email" error={errors.email?.message}>
              <Input type="email" autoComplete="email" placeholder="you@company.com" {...register('email')} />
            </Field>

            <Field
              label="Password"
              action={<Link to="/forgot-password" className="text-xs font-medium text-accent hover:underline">Forgot password?</Link>}
              error={errors.password?.message}
            >
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
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
              {isSubmitting ? 'Signing in…' : 'Sign in'}
              {!isSubmitting && <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          New to FlowForge?{' '}
          <Link to="/signup" className="font-medium text-accent hover:underline">Create an account</Link>
        </p>
      </div>
    </div>
  );
}
