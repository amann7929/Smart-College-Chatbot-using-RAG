import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AdminPage from './AdminPage';
import { AdminRoute } from '../components/layout/RouteGuards';
import * as api from '../api';
import { ADMIN, axiosError, renderApp } from '../test/utils';

vi.mock('../api', async () => (await import('../test/apiMock.js')).createApiMock());

const STATS = { total_users: 42, active_users: 40, total_documents: 10, indexed_documents: 6, failed_documents: 2, pending_documents: 1, processing_documents: 1, total_chunks: 321, total_questions: 1234, total_chats: 210 };
const user = (over) => ({ id: 'u2', email: 'stu@example.com', full_name: 'Riya Das', role: 'student', is_active: true, theme_preference: 'light', chat_preferences: {}, created_at: '2026-02-01T10:00:00Z', ...over });
const page = <Routes><Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} /></Routes>;

beforeEach(() => {
  vi.clearAllMocks();
  api.adminApi.stats.mockResolvedValue(STATS);
  api.adminApi.usage.mockResolvedValue([{ day: '2026-06-01', questions: 3, new_users: 1 }, { day: '2026-06-02', questions: 0, new_users: 0 }]);
  api.adminApi.feedback.mockResolvedValue({ total: 4, positive: 3, negative: 1, positive_rate: 0.75 });
  api.adminApi.activity.mockResolvedValue([
    { id: 'l1', user_id: 'u2', user_email: 'stu@example.com', action: 'document.upload', entity_type: 'document', entity_id: 'd1', details: null, created_at: new Date().toISOString() },
    { id: 'l2', user_id: null, user_email: null, action: 'auth.login_failed', entity_type: null, entity_id: null, details: { email: 'x@example.com' }, created_at: new Date().toISOString() },
  ]);
  api.adminApi.users.mockResolvedValue({ items: [ADMIN, user()], total: 2, page: 1, page_size: 8 });
});

describe('Admin dashboard', () => {
  it('shows the key numbers, document status, feedback and recent activity', async () => {
    renderApp(page, { route: '/admin', user: ADMIN });
    expect(await screen.findByText('1,234')).toBeInTheDocument();                       // questions asked
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('321')).toBeInTheDocument();
    expect(screen.getByText('40 active')).toBeInTheDocument();
    expect(screen.getByText('6 indexed')).toBeInTheDocument();
    const docs = screen.getByRole('region', { name: 'Document processing' });
    expect(within(docs).getByText('Failed').nextSibling).toHaveTextContent('2');
    expect(within(docs).getByText('Queued').nextSibling).toHaveTextContent('1');
    expect(await screen.findByText('75%')).toBeInTheDocument();                         // feedback rate
    expect(screen.getByText('Uploaded document')).toBeInTheDocument();
    expect(screen.getByText(/for x@example.com/)).toBeInTheDocument();                  // failed sign-in shows the attempted email
    expect(screen.getByRole('img', { name: /Area chart of questions asked/ })).toBeInTheDocument();
  });

  it('reloads usage when the period changes', async () => {
    renderApp(page, { route: '/admin', user: ADMIN });
    await screen.findByText('1,234');
    expect(api.adminApi.usage).toHaveBeenCalledWith(14);
    await userEvent.selectOptions(screen.getByLabelText('Usage period'), '30');
    await waitFor(() => expect(api.adminApi.usage).toHaveBeenLastCalledWith(30));
  });

  it('shows friendly empty states when there is no data yet', async () => {
    api.adminApi.stats.mockResolvedValue({ ...STATS, total_documents: 0 });
    api.adminApi.feedback.mockResolvedValue({ total: 0, positive: 0, negative: 0, positive_rate: null });
    api.adminApi.activity.mockResolvedValue([]);
    renderApp(page, { route: '/admin', user: ADMIN });
    expect(await screen.findByText('No feedback yet')).toBeInTheDocument();
    expect(screen.getByText('No documents yet')).toBeInTheDocument();
    expect(screen.getByText('No activity recorded yet')).toBeInTheDocument();
  });

  it('shows an error with retry if the statistics fail to load', async () => {
    api.adminApi.stats.mockRejectedValueOnce(axiosError(500, {})).mockResolvedValue(STATS);
    renderApp(page, { route: '/admin', user: ADMIN });
    await userEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('1,234')).toBeInTheDocument();
  });
});

describe('User management', () => {
  it('protects the signed-in admin from changing or deleting themselves', async () => {
    renderApp(page, { route: '/admin', user: ADMIN });
    expect(await screen.findByLabelText('Role for Admin User')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete Admin User' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Deactivate Admin User' })).toBeDisabled();
    expect(screen.getByLabelText('Role for Riya Das')).toBeEnabled();
  });

  it('changes a role only after confirmation', async () => {
    api.adminApi.updateUser.mockResolvedValue(user({ role: 'admin' }));
    renderApp(page, { route: '/admin', user: ADMIN });
    await userEvent.selectOptions(await screen.findByLabelText('Role for Riya Das'), 'admin');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/full administrator access/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(api.adminApi.updateUser).not.toHaveBeenCalled();
    await userEvent.selectOptions(screen.getByLabelText('Role for Riya Das'), 'admin');
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Change role' }));
    await waitFor(() => expect(api.adminApi.updateUser).toHaveBeenCalledWith('u2', { role: 'admin' }));
  });

  it('deactivates and deletes users with confirmation, and surfaces server refusals', async () => {
    api.adminApi.updateUser.mockResolvedValue(user({ is_active: false }));
    api.adminApi.deleteUser.mockRejectedValue(axiosError(400, { detail: 'This would leave the system without an active administrator.' }));
    renderApp(page, { route: '/admin', user: ADMIN });
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate Riya Das' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(api.adminApi.updateUser).toHaveBeenCalledWith('u2', { is_active: false }));

    await userEvent.click(await screen.findByRole('button', { name: 'Delete Riya Das' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete user' }));
    await waitFor(() => expect(api.adminApi.deleteUser).toHaveBeenCalledWith('u2'));
    expect(await screen.findByText(/without an active administrator/)).toBeInTheDocument();    // toast with the server's reason
  });

  it('searches and filters users', async () => {
    renderApp(page, { route: '/admin', user: ADMIN });
    await screen.findByText('Riya Das');
    await userEvent.type(screen.getByLabelText('Search users'), 'riya');
    await userEvent.selectOptions(screen.getByLabelText('Filter by role'), 'student');
    await waitFor(() => expect(api.adminApi.users).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'riya', role: 'student', page: 1 })));
  });
});
