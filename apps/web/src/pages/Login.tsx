import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginSchema, type LoginInput } from '@flowforge/shared/src/schemas/auth';
import { Hexagon, ArrowRight, AlertCircle, Eye, EyeOff } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';
import Logo from '../components/Logo';

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
      setError(err.response?.data?.message || 'Invalid credentials');
    }
  };

  return (
    <div className="min-h-screen bg-base-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 ">
      <div className="absolute top-4 right-4"><ThemeToggle /></div>
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <Link to="/" className="flex justify-center items-center gap-2 group">
          <Logo size="lg" />
        </Link>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-base-content font-headline-md">
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-base-content/70">
          Or{' '}
          <Link to="/signup" className="font-medium text-primary hover:text-primary-container transition-colors">
            start your 14-day free trial
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-base-200 py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-base-300 relative overflow-hidden">
          
          {/* Subtle glow effect behind the form */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150%] h-[100px] bg-primary/10 blur-[80px] pointer-events-none rounded-[100%]" />

          <form className="space-y-6 relative" onSubmit={handleSubmit(onSubmit)}>
            
            {error && (
              <div className="bg-error/10 border border-error/50 text-error p-3 rounded flex items-center gap-2 text-sm">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-base-content/70">
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  type="email"
                  {...register('email')}
                  className="appearance-none block w-full px-3 py-2 border border-base-300 rounded-md shadow-sm bg-base-100 text-base-content placeholder-on-surface-variant/50 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm transition-colors"
                />
                {errors.email && <p className="mt-1 text-sm text-error">{errors.email.message}</p>}
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-base-content/70">
                Password
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  {...register('password')}
                  className="appearance-none block w-full px-3 py-2 pr-10 border border-base-300 rounded-md bg-base-100 text-base-content placeholder-on-surface-variant/50 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm transition-colors"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-base-content/70 hover:text-primary transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-sm text-error">{errors.password.message}</p>}
            </div>

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-content bg-primary text-primary-content hover:bg-secondary-container focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary focus:ring-offset-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                {isSubmitting ? 'Authenticating...' : 'Sign in'}
                {!isSubmitting && <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={18} />}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

