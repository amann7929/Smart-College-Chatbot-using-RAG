import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';

export const THEME_KEY = 'clgbot_theme';
const ThemeContext = createContext(null);

function initialTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
  const { user, updateProfile } = useAuth();
  const [theme, setThemeState] = useState(initialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // When someone signs in, adopt the preference saved on their account
  useEffect(() => {
    if (user?.theme_preference && user.theme_preference !== theme) setThemeState(user.theme_preference);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const setTheme = useCallback(async (next) => {
    setThemeState(next);
    if (user && user.theme_preference !== next) {
      try { await updateProfile({ theme_preference: next }); } catch { /* local preference still applies */ }
    }
  }, [user, updateProfile]);

  const toggle = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme]);
  const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
