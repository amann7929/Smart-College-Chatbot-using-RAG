import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';

const ConfirmContext = createContext(null);

/** `const confirm = useConfirm(); if (await confirm({ title, message, confirmText, danger })) ...` */
export function ConfirmProvider({ children }) {
  const [opts, setOpts] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => { resolver.current = resolve; setOpts(options); }), []);
  const close = useCallback((answer) => { resolver.current?.(answer); resolver.current = null; setOpts(null); }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!opts} onClose={() => close(false)} size="sm" title={opts?.title || 'Are you sure?'}
        footer={(
          <>
            <Button variant="secondary" data-autofocus onClick={() => close(false)}>{opts?.cancelText || 'Cancel'}</Button>
            <Button variant={opts?.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{opts?.confirmText || 'Confirm'}</Button>
          </>
        )}
      >
        <p className="text-sm text-slate-600 dark:text-slate-300">{opts?.message}</p>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}
