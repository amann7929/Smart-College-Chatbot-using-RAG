import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ToastProvider } from '../context/ToastContext';
import { ConfirmProvider } from '../context/ConfirmContext';
import * as api from '../api';

export const STUDENT = { id: 'u1', email: 'stu@example.com', full_name: 'Riya Das', role: 'student', is_active: true, theme_preference: 'light', chat_preferences: {}, created_at: '2026-01-05T10:00:00Z' };
export const ADMIN = { ...STUDENT, id: 'a1', email: 'admin@example.com', full_name: 'Admin User', role: 'admin' };

/** Render inside all providers. Pass `user` to start signed in (the mocked /auth/me returns it). */
export function renderApp(ui, { route = '/', user = null } = {}) {
  if (user) {
    localStorage.setItem('clgbot_token', 'test-token');
    api.authApi.me.mockResolvedValue(user);
  } else {
    localStorage.removeItem('clgbot_token');
  }
  return render(
    <MemoryRouter initialEntries={[route]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider><ThemeProvider><ToastProvider><ConfirmProvider>{ui}</ConfirmProvider></ToastProvider></ThemeProvider></AuthProvider>
    </MemoryRouter>,
  );
}

export const axiosError = (status, data) => Object.assign(new Error('request failed'), { response: { status, data } });
