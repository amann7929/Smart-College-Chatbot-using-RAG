import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api';

/** Loads data with loading/error state; ignores responses that arrive after a newer request started. */
export function useFetch(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const latest = useRef(0);
  const run = useCallback(async (silent = false) => {
    const id = ++latest.current;
    if (!silent) setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const data = await fn();
      if (id === latest.current) setState({ data, loading: false, error: '' });
    } catch (e) {
      if (id === latest.current) setState((s) => ({ ...s, loading: false, error: errorMessage(e) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { ...state, reload: run };
}
