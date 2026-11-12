import { useEffect, useRef } from 'react';
import { SendHorizontal } from 'lucide-react';
import { MAX_QUESTION_LENGTH } from '../../lib/constants';

export default function Composer({ value, onChange, onSubmit, disabled }) {
  const ref = useRef(null);

  // Auto-grow up to ~6 lines
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const canSend = value.trim().length > 0 && value.length <= MAX_QUESTION_LENGTH && !disabled;
  const submit = (e) => { e?.preventDefault(); if (canSend) onSubmit(); };
  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
  };

  return (
    <form onSubmit={submit} className="border-t border-slate-200 bg-white/90 px-3 pb-3 pt-3 backdrop-blur dark:border-navy-800 dark:bg-navy-950/90 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-2 shadow-card focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/25 dark:border-navy-700 dark:bg-navy-900">
          <label htmlFor="composer" className="sr-only">Ask a question about the college</label>
          <textarea
            id="composer" ref={ref} rows={1} value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Ask about fees, admissions, hostel, exams..."
            className="max-h-40 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none dark:text-slate-100"
          />
          <button type="submit" disabled={!canSend} aria-label="Send question"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-violet-600 text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
            <SendHorizontal className="h-[18px] w-[18px]" aria-hidden />
          </button>
        </div>
        <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] text-slate-400">
          <span><span className="hidden sm:inline">Enter to send, Shift+Enter for a new line. Answers come from the uploaded documents; verify important details with the college office.</span><span className="sm:hidden">Answers come from the uploaded documents.</span></span>
          <span className={value.length > MAX_QUESTION_LENGTH ? 'font-semibold text-red-500' : ''} aria-live="polite">{value.length}/{MAX_QUESTION_LENGTH}</span>
        </div>
      </div>
    </form>
  );
}
