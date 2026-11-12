import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import LoginPage from './LoginPage';
import RegisterPage from './RegisterPage';
import { AdminRoute, ProtectedRoute, PublicOnlyRoute } from '../components/layout/RouteGuards';
import * as api from '../api';
import { ADMIN, STUDENT, axiosError, renderApp } from '../test/utils';

vi.mock('../api', async () => (await import('../test/apiMock.js')).createApiMock());

const routes = (
  <Routes>
    <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
    <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
    <Route path="/chat" element={<ProtectedRoute><p>CHAT AREA</p></ProtectedRoute>} />
    <Route path="/admin" element={<AdminRoute><p>ADMIN AREA</p></AdminRoute>} />
  </Routes>
);

beforeEach(() => vi.clearAllMocks());

describe('Login', () => {
  it('shows validation errors without calling the API', async () => {
    renderApp(routes, { route: '/login' });
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Email is required.')).toBeInTheDocument();
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(api.authApi.login).not.toHaveBeenCalled();
  });

  it('signs in, stores the token and goes to the chat', async () => {
    api.authApi.login.mockResolvedValue({ access_token: 'jwt-1', user: STUDENT });
    renderApp(routes, { route: '/login' });
    await userEvent.type(await screen.findByLabelText('Email'), 'stu@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'StrongPass1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('CHAT AREA')).toBeInTheDocument();
    expect(api.authApi.login).toHaveBeenCalledWith({ email: 'stu@example.com', password: 'StrongPass1' });
    expect(localStorage.getItem('clgbot_token')).toBe('jwt-1');
  });

  it('shows the server error for wrong credentials', async () => {
    api.authApi.login.mockRejectedValue(axiosError(401, { detail: 'Invalid email or password.' }));
    renderApp(routes, { route: '/login' });
    await userEvent.type(await screen.findByLabelText('Email'), 'stu@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'WrongPass1');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
    expect(localStorage.getItem('clgbot_token')).toBeNull();
  });

  it('can toggle password visibility', async () => {
    renderApp(routes, { route: '/login' });
    const input = await screen.findByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');
  });
});

describe('Register', () => {
  it('validates name, email, password strength and confirmation', async () => {
    renderApp(routes, { route: '/register' });
    await userEvent.type(await screen.findByLabelText('Full name'), 'R');
    await userEvent.type(screen.getByLabelText('Email'), 'bad');
    await userEvent.type(screen.getByLabelText('Password'), 'weak');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'different');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText(/at least 2 characters/)).toBeInTheDocument();
    expect(screen.getByText('Enter a valid email address.')).toBeInTheDocument();
    expect(screen.getByText(/Password needs/)).toBeInTheDocument();
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(api.authApi.register).not.toHaveBeenCalled();
  });

  it('registers a student and lands in the app', async () => {
    api.authApi.register.mockResolvedValue({ access_token: 'jwt-2', user: STUDENT });
    renderApp(routes, { route: '/register' });
    await userEvent.type(await screen.findByLabelText('Full name'), 'Riya Das');
    await userEvent.type(screen.getByLabelText('Email'), 'stu@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'StrongPass1');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'StrongPass1');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('CHAT AREA')).toBeInTheDocument();
    expect(api.authApi.register).toHaveBeenCalledWith({ email: 'stu@example.com', full_name: 'Riya Das', password: 'StrongPass1' });
  });

  it('shows a duplicate-email error from the server', async () => {
    api.authApi.register.mockRejectedValue(axiosError(409, { detail: 'An account with this email already exists.' }));
    renderApp(routes, { route: '/register' });
    await userEvent.type(await screen.findByLabelText('Full name'), 'Riya Das');
    await userEvent.type(screen.getByLabelText('Email'), 'stu@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'StrongPass1');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'StrongPass1');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
  });
});

describe('Route protection', () => {
  it('sends anonymous visitors to the login page', async () => {
    renderApp(routes, { route: '/chat' });
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(screen.queryByText('CHAT AREA')).not.toBeInTheDocument();
  });

  it('keeps students out of the admin area', async () => {
    renderApp(routes, { route: '/admin', user: STUDENT });
    expect(await screen.findByText('CHAT AREA')).toBeInTheDocument();
    expect(screen.queryByText('ADMIN AREA')).not.toBeInTheDocument();
  });

  it('lets admins in', async () => {
    renderApp(routes, { route: '/admin', user: ADMIN });
    expect(await screen.findByText('ADMIN AREA')).toBeInTheDocument();
  });

  it('bounces signed-in users away from the login page', async () => {
    renderApp(routes, { route: '/login', user: STUDENT });
    expect(await screen.findByText('CHAT AREA')).toBeInTheDocument();
  });

  it('drops an invalid stored token', async () => {
    localStorage.setItem('clgbot_token', 'stale');
    api.authApi.me.mockRejectedValue(axiosError(401, { detail: 'Could not validate credentials.' }));
    renderApp(routes, { route: '/chat' });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument());
    expect(localStorage.getItem('clgbot_token')).toBeNull();
  });
});
