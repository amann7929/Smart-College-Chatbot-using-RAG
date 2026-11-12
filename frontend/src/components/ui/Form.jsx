import { forwardRef, useId } from 'react';

export function Field({ label, id, error, hint, children, className = '' }) {
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>}
      {children}
      {hint && !error && <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

export const TextInput = forwardRef(function TextInput({ label, error, hint, className = '', id, icon: Icon, ...props }, ref) {
  const auto = useId();
  const inputId = id || auto;
  return (
    <Field label={label} id={inputId} error={error} hint={hint} className={className}>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />}
        <input
          ref={ref} id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={`input ${Icon ? 'pl-10' : ''} ${error ? 'input-error' : ''}`}
          {...props}
        />
      </div>
    </Field>
  );
});

export const Select = forwardRef(function Select({ label, error, className = '', id, children, ...props }, ref) {
  const auto = useId();
  const selectId = id || auto;
  return (
    <Field label={label} id={selectId} error={error} className={className}>
      <select ref={ref} id={selectId} className={`input pr-8 ${error ? 'input-error' : ''}`} {...props}>{children}</select>
    </Field>
  );
});

export function Toggle({ checked, onChange, label, description, disabled }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-slate-800 dark:text-slate-200">{label}</label>
        {description && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      <button
        id={id} type="button" role="switch" aria-checked={checked} disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-50 ${checked ? 'bg-brand-600' : 'bg-slate-300 dark:bg-navy-700'}`}
      >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}
