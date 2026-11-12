import { forwardRef, useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { TextInput } from './Form';

export const PasswordInput = forwardRef(function PasswordInput({ label = 'Password', ...props }, ref) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <TextInput ref={ref} label={label} type={show ? 'text' : 'password'} icon={Lock} className="[&_input]:pr-11" {...props} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-2 top-[31px] rounded-md p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
        {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  );
});

export function PasswordChecklist({ checks }) {
  return (
    <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1" aria-label="Password requirements">
      {checks.map((c) => (
        <li key={c.label} className={`text-xs ${c.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
          <span aria-hidden>{c.ok ? '\u2713' : '\u2022'}</span> {c.label}<span className="sr-only">{c.ok ? ' (met)' : ' (not met)'}</span>
        </li>
      ))}
    </ul>
  );
}
