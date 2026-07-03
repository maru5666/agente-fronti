import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { Loader2 } from 'lucide-react';
import { FrontiMark } from './fronti-logo';

export function Button({
  children,
  className = '',
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}) {
  const variants = {
    primary:
      'bg-ink text-canvas shadow-lg shadow-white/10 hover:bg-white',
    secondary:
      'border border-line bg-white/[0.045] text-ink hover:bg-white/[0.085]',
    danger: 'bg-danger text-white hover:bg-red-500',
    ghost: 'text-muted hover:bg-white/[0.075] hover:text-ink',
  };

  return (
    <button
      className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 text-sm font-medium transition duration-200 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Input({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`h-10 w-full min-w-0 rounded-xl border border-line bg-white/[0.045] px-3 text-sm text-ink outline-none transition placeholder:text-slate-500 focus:border-brand ${className}`}
      {...props}
    />
  );
}

export function Select({
  children,
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`h-10 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-brand ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`min-h-24 w-full min-w-0 rounded-xl border border-line bg-white/[0.045] px-3 py-2 text-sm text-ink outline-none transition placeholder:text-slate-500 focus:border-brand ${className}`}
      {...props}
    />
  );
}

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm">
      <span className="font-medium text-slate-200">{label}</span>
      {children}
      {error ? <span className="text-xs text-red-500">{error}</span> : null}
    </label>
  );
}

export function Panel({
  title,
  description,
  action,
  children,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="glass-panel rounded-[20px]">
      {(title || description || action) && (
        <div className="flex flex-col gap-3 border-b border-line p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {title ? <h2 className="text-base font-semibold text-ink">{title}</h2> : null}
            {description ? (
              <p className="mt-1 text-sm text-muted">{description}</p>
            ) : null}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="glass-panel rounded-[20px] p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
      {detail ? <p className="mt-1 text-xs text-muted">{detail}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="grid min-h-44 place-items-center rounded-[20px] border border-dashed border-line bg-white/[0.03] p-6 text-center">
      <div>
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-line bg-white/5">
          <FrontiMark className="h-10 w-10" />
        </div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="mt-1 max-w-md text-sm text-muted">{description}</p>
      </div>
    </div>
  );
}

export function LoadingState({ label = 'Cargando' }: { label?: string }) {
  return (
    <div className="grid min-h-36 gap-3 rounded-[20px] border border-line bg-white/[0.03] p-5">
      <div className="skeleton h-5 w-1/3 rounded-full" />
      <div className="skeleton h-16 rounded-2xl" />
      <div className="flex items-center gap-2 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        {label}
      </div>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-100">
      {message}
    </div>
  );
}

export function StatusBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-full border border-line bg-white/[0.045] px-2 py-1 text-xs font-medium text-slate-300">
      {children}
    </span>
  );
}
