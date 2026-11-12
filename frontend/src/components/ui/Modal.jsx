import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';
const SIZES = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };

export function Modal({ open, onClose, title, description, children, footer, size = 'md' }) {
  const panel = useRef(null);
  const titleId = useRef(`modal-${Math.random().toString(36).slice(2, 8)}`).current;
  // Keep the latest onClose in a ref: callers pass a new function every render, and re-running the
  // effect below on each render would steal focus from the field the user is typing in.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current(); return; }
      if (e.key !== 'Tab' || !panel.current) return;
      const items = [...panel.current.querySelectorAll(FOCUSABLE)];
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => {
      const target = panel.current?.querySelector('[data-autofocus]') || panel.current?.querySelector('input,select,textarea') || panel.current;
      target?.focus();
    }, 30);
    return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) onCloseRef.current(); }}
        >
          <motion.div
            ref={panel}
            role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
            className={`card w-full ${SIZES[size]} max-h-[92vh] overflow-y-auto rounded-b-none p-5 shadow-2xl sm:rounded-2xl sm:p-6`}
            initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.18 }}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
                {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
              </div>
              <button type="button" onClick={onClose} aria-label="Close dialog"
                className="-mr-1 -mt-1 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-navy-800 dark:hover:text-slate-200">
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            {children}
            {footer && <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
