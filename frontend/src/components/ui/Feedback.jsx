import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';
import { initials } from '../../lib/format';

const TONES = {
  slate: 'bg-slate-100 text-slate-700 dark:bg-navy-800 dark:text-slate-300',
  blue: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200',
  green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  red: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  violet: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-200',
  amber: 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
};

export function Badge({ tone = 'slate', children, className = '', ...props }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`} {...props}>{children}</span>;
}

export function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function Spinner({ className = 'h-5 w-5' }) {
  return <span role="status" aria-label="Loading" className={`inline-block animate-spin rounded-full border-2 border-brand-200 border-t-brand-600 ${className}`} />;
}

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-violet-50 text-brand-600 dark:from-navy-800 dark:to-navy-800 dark:text-brand-300">
          <Icon className="h-7 w-7" aria-hidden />
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300">
        <AlertTriangle className="h-6 w-6" aria-hidden />
      </div>
      <p className="max-w-sm text-sm text-slate-600 dark:text-slate-300">{message}</p>
      {onRetry && <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function Avatar({ name, size = 'md' }) {
  const s = size === 'sm' ? 'h-8 w-8 text-xs' : size === 'lg' ? 'h-14 w-14 text-lg' : 'h-9 w-9 text-sm';
  return (
    <span aria-hidden className={`inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 font-semibold text-white ${s}`}>
      {initials(name)}
    </span>
  );
}

export function Logo({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      <span className="text-lg font-bold tracking-tight text-navy-900 dark:text-white">Clg<span className="gradient-text">Bot</span></span>
    </span>
  );
}

export function PageSpinner() {
  return <div className="flex h-screen items-center justify-center"><Spinner className="h-8 w-8" /></div>;
}
