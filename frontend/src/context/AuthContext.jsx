import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, usersApi } from '../api';
import { TOKEN_KEY } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => !!localStorage.getItem(TOKEN_KEY));

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  // Restore the session on first load
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    let cancelled = false;
    authApi.me()
      .then((u) => !cancelled && setUser(u))
      .catch(() => !cancelled && clearSession())
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [clearSession]);

  // Token expired / revoked while using the app
  useEffect(() => {
    const onExpired = () => clearSession();
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [clearSession]);

  const startSession = useCallback((payload) => {
    localStorage.setItem(TOKEN_KEY, payload.access_token);
    setUser(payload.user);
    return payload.user;
  }, []);

  const login = useCallback(async (email, password) => startSession(await authApi.login({ email, password })), [startSession]);
  const register = useCallback(
    async (email, full_name, password) => startSession(await authApi.register({ email, full_name, password })),
    [startSession],
  );

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* the token is discarded either way */ }
    clearSession();
  }, [clearSession]);

  const updateProfile = useCallback(async (patch) => {
    const updated = await usersApi.update(patch);
    setUser(updated);
    return updated;
  }, []);

  const changePassword = useCallback(async (current_password, new_password) => {
    const payload = await usersApi.changePassword({ current_password, new_password });
    startSession(payload); // the server revoked the old token and issued a new one
  }, [startSession]);

  const value = useMemo(
    () => ({ user, loading, isAdmin: user?.role === 'admin', login, register, logout, updateProfile, changePassword }),
    [user, loading, login, register, logout, updateProfile, changePassword],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
