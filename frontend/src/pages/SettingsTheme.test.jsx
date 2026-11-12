import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import SettingsPage from './SettingsPage';
import LandingPage from './LandingPage';
import { ProtectedRoute } from '../components/layout/RouteGuards';
import * as api from '../api';
import { STUDENT, axiosError, renderApp } from '../test/utils';

vi.mock('../api', async () => (await import('../test/apiMock.js')).createApiMock());

const settings = <Routes><Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} /></Routes>;
beforeEach(() => vi.clearAllMocks());

describe('Settings', () => {
  it('saves a new name and validates it first', async () => {
    api.usersApi.update.mockImplementation(async (b) => ({ ...STUDENT, ...b }));
    renderApp(settings, { route: '/settings', user: STUDENT });
    const name = await screen.findByLabelText('Full name');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();           // unchanged
    await userEvent.clear(name);
    await userEvent.type(name, 'R');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/at least 2 characters/)).toBeInTheDocument();
    expect(api.usersApi.update).not.toHaveBeenCalled();
    await userEvent.type(name, 'iya Sharma');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.usersApi.update).toHaveBeenCalledWith({ full_name: 'Riya Sharma' }));
  });

  it('keeps the email read-only', async () => {
    renderApp(settings, { route: '/settings', user: STUDENT });
    expect(await screen.findByLabelText('Email')).toBeDisabled();
  });

  it('saves chat preferences as soon as a switch is flipped', async () => {
    api.usersApi.update.mockImplementation(async (b) => ({ ...STUDENT, chat_preferences: b.chat_preferences }));
    renderApp(settings, { route: '/settings', user: STUDENT });
    const toggle = await screen.findByRole('switch', { name: 'Show sources under answers' });
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(toggle);
    await waitFor(() => expect(api.usersApi.update).toHaveBeenCalledWith({ chat_preferences: { show_sources: false } }));
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'false'));
  });

  it('validates the password form before calling the API', async () => {
    renderApp(settings, { route: '/settings', user: STUDENT });
    await userEvent.type(await screen.findByLabelText('Current password'), 'StrongPass1');
    await userEvent.type(screen.getByLabelText('New password'), 'StrongPass1');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'Other');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByText(/different password/)).toBeInTheDocument();
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(api.usersApi.changePassword).not.toHaveBeenCalled();
  });

  it('changes the password and swaps in the new token', async () => {
    api.usersApi.changePassword.mockResolvedValue({ access_token: 'new-token', user: STUDENT });
    renderApp(settings, { route: '/settings', user: STUDENT });
    await userEvent.type(await screen.findByLabelText('Current password'), 'StrongPass1');
    await userEvent.type(screen.getByLabelText('New password'), 'BrandNewPass9');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'BrandNewPass9');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));
    await waitFor(() => expect(api.usersApi.changePassword).toHaveBeenCalledWith({ current_password: 'StrongPass1', new_password: 'BrandNewPass9' }));
    await waitFor(() => expect(localStorage.getItem('clgbot_token')).toBe('new-token'));
    expect(screen.getByLabelText('Current password')).toHaveValue('');
  });

  it('shows "current password is incorrect" on the right field', async () => {
    api.usersApi.changePassword.mockRejectedValue(axiosError(400, { detail: 'Current password is incorrect.' }));
    renderApp(settings, { route: '/settings', user: STUDENT });
    await userEvent.type(await screen.findByLabelText('Current password'), 'Wrong12345');
    await userEvent.type(screen.getByLabelText('New password'), 'BrandNewPass9');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'BrandNewPass9');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));
    expect(await screen.findByText('Current password is incorrect.')).toBeInTheDocument();
  });

  it('signs out', async () => {
    api.authApi.logout.mockResolvedValue({});
    renderApp(<Routes><Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} /><Route path="/login" element={<p>LOGIN SCREEN</p>} /></Routes>, { route: '/settings', user: STUDENT });
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(await screen.findByText('LOGIN SCREEN')).toBeInTheDocument();
    expect(localStorage.getItem('clgbot_token')).toBeNull();
  });
});

describe('Theme', () => {
  it('applies dark mode to the page, persists it locally and saves it to the account', async () => {
    api.usersApi.update.mockImplementation(async (b) => ({ ...STUDENT, ...b }));
    renderApp(settings, { route: '/settings', user: STUDENT });
    await userEvent.click(await screen.findByRole('radio', { name: 'Dark' }));
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true));
    expect(localStorage.getItem('clgbot_theme')).toBe('dark');
    expect(api.usersApi.update).toHaveBeenCalledWith({ theme_preference: 'dark' });
    await userEvent.click(screen.getByRole('radio', { name: 'Light' }));
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(false));
  });

  it('adopts the theme saved on the account at sign-in', async () => {
    renderApp(settings, { route: '/settings', user: { ...STUDENT, theme_preference: 'dark' } });
    await waitFor(() => expect(document.documentElement.classList.contains('dark')).toBe(true));
  });
});

describe('Landing page', () => {
  const landing = <Routes><Route path="/" element={<LandingPage />} /></Routes>;

  it('presents the product and the main calls to action', async () => {
    renderApp(landing);
    expect(await screen.findByRole('heading', { level: 1, name: /answers from your own documents/ })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Log in' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Get started/ }).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'The RAG workflow' })).toBeInTheDocument();
    for (const t of ['Upload PDF', 'Create embeddings', 'Store in ChromaDB', 'Retrieve top-k', 'Generate with Groq']) expect(screen.getByText(t)).toBeInTheDocument();
    expect(screen.getByText('Fee Structure')).toBeInTheDocument();
    expect(screen.getByText('Contact Information')).toBeInTheDocument();
    expect(screen.getByText(/sample answers from the fictional demo documents \(no live AI\)/)).toBeInTheDocument();
  });

  it('offers "Open chat" when already signed in', async () => {
    renderApp(landing, { user: STUDENT });
    expect((await screen.findAllByRole('link', { name: 'Open chat' })).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument();
  });

  it('chat preview answers sample questions and shows the honest "not in documents" case', async () => {
    renderApp(landing);
    await userEvent.click(await screen.findByRole('button', { name: 'What is the tuition fee for CSE?' }));
    expect(await screen.findByText(/95,000 per year/, {}, { timeout: 3500 })).toBeInTheDocument();
    expect(screen.getByText(/SAMPLE_Fee_Structure.pdf/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'What is on the canteen menu today?' }));
    expect(await screen.findByText(/do not contain sufficient information/, {}, { timeout: 3500 })).toBeInTheDocument();
  });
});
