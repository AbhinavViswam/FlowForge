import React from 'react';
import { Loader2, X } from 'lucide-react';

/** Tiny classnames joiner. */
export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

/* -------------------------------------------------------------- Button */
type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
};

const btnBase =
  'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-50 ' +
  'disabled:cursor-not-allowed active:scale-[0.98] select-none whitespace-nowrap';

const btnVariants: Record<string, string> = {
  primary: 'bg-accent text-accent-ink hover:opacity-90 shadow-sm',
  secondary: 'bg-surface text-ink border border-line hover:bg-surface-2',
  ghost: 'text-muted hover:text-ink hover:bg-surface-2',
  danger: 'bg-danger/10 text-danger border border-danger/25 hover:bg-danger/20',
};

const btnSizes: Record<string, string> = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-[15px]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={cn(btnBase, btnVariants[variant], btnSizes[size], className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

/* ---------------------------------------------------------- IconButton */
type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string };

export function IconButton({ label, className, children, ...rest }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center w-9 h-9 rounded-lg text-muted',
        'hover:text-ink hover:bg-surface-2 transition-colors focus:outline-none',
        'focus-visible:ring-2 focus-visible:ring-accent/50',
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* --------------------------------------------------------------- Input */
const fieldBase =
  'w-full rounded-lg bg-surface-2 border border-line text-ink placeholder:text-faint ' +
  'transition-colors focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 ' +
  'disabled:opacity-60 disabled:cursor-not-allowed';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => (
    <input ref={ref} className={cn(fieldBase, 'h-10 px-3 text-sm', className)} {...rest} />
  )
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...rest }, ref) => (
    <textarea ref={ref} className={cn(fieldBase, 'px-3 py-2 text-sm leading-relaxed', className)} {...rest} />
  )
);
Textarea.displayName = 'Textarea';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...rest }, ref) => (
    <select ref={ref} className={cn(fieldBase, 'h-10 px-3 text-sm', className)} {...rest}>
      {children}
    </select>
  )
);
Select.displayName = 'Select';

/* --------------------------------------------------------------- Field */
export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && <label className="text-[13px] font-medium text-ink">{label}</label>}
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- Card */
export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('rounded-2xl border border-line bg-surface shadow-card', className)} {...rest}>
      {children}
    </div>
  );
}

/* --------------------------------------------------------------- Badge */
const badgeTones: Record<string, string> = {
  neutral: 'bg-surface-2 text-muted border-line',
  ok: 'bg-ok/10 text-ok border-ok/25',
  warn: 'bg-warn/10 text-warn border-warn/25',
  danger: 'bg-danger/10 text-danger border-danger/25',
  accent: 'bg-accent-soft text-accent border-accent/20',
};

export function Badge({
  tone = 'neutral',
  dot = false,
  className,
  children,
}: {
  tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'accent';
  dot?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[11px] font-medium',
        badgeTones[tone],
        className
      )}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* -------------------------------------------------------------- Toggle */
export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-50',
        checked ? 'bg-accent' : 'bg-line'
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}

/* ------------------------------------------------------------- Spinner */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('animate-spin text-muted', className)} />;
}

/* --------------------------------------------------------------- Modal */
export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  if (!open) return null;
  const width = size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-2xl' : 'max-w-md';
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className={cn('w-full rounded-2xl border border-line bg-surface shadow-pop animate-scale-in', width)}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-line">
            <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
            <IconButton label="Close" onClick={onClose} className="w-8 h-8">
              <X className="w-4 h-4" />
            </IconButton>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- EmptyState */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-6 py-14 rounded-2xl',
        'border border-dashed border-line bg-surface',
        className
      )}
    >
      {icon && (
        <div className="w-12 h-12 rounded-xl bg-accent-soft text-accent flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1.5 text-sm text-muted max-w-md">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
