import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import KnowledgeBasePage from './KnowledgeBasePage';
import { ProtectedRoute } from '../components/layout/RouteGuards';
import * as api from '../api';
import { ADMIN, STUDENT, axiosError, renderApp } from '../test/utils';

vi.mock('../api', async () => (await import('../test/apiMock.js')).createApiMock());

const doc = (over) => ({ id: 'd1', original_filename: 'Fees.pdf', category: 'Fee Structure', file_size: 2048, status: 'indexed', error_message: null, page_count: 2, chunk_count: 7, created_at: '2026-06-01T10:00:00Z', indexed_at: '2026-06-01T10:01:00Z', ...over });
const page = <Routes><Route path="/kb" element={<ProtectedRoute><KnowledgeBasePage /></ProtectedRoute>} /></Routes>;
const list = (items, total = items.length) => ({ items, total, page: 1, page_size: 10 });

beforeEach(() => {
  vi.clearAllMocks();
  api.docsApi.categories.mockResolvedValue(['Fee Structure', 'Syllabus']);
});

describe('Knowledge base', () => {
  it('lists documents with category, date, status and chunk count', async () => {
    api.docsApi.list.mockResolvedValue(list([doc(), doc({ id: 'd2', original_filename: 'Syllabus.pdf', category: 'Syllabus', chunk_count: 12 })]));
    renderApp(page, { route: '/kb', user: STUDENT });
    expect(await screen.findByText('Fees.pdf')).toBeInTheDocument();
    expect(screen.getByText('Syllabus.pdf')).toBeInTheDocument();
    expect(screen.getAllByText('Indexed', { selector: 'span' })).toHaveLength(2);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getAllByText(/Jun 1, 2026|1 Jun 2026/).length).toBe(2);
  });

  it('hides upload, retry and delete from students', async () => {
    api.docsApi.list.mockResolvedValue(list([doc({ status: 'failed', error_message: 'No extractable text.' })]));
    renderApp(page, { route: '/kb', user: STUDENT });
    expect(await screen.findByText(/No extractable text/)).toBeInTheDocument();      // students still see why it failed
    expect(screen.queryByRole('button', { name: /Upload document/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Retry indexing/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
  });

  it('shows the indexing error and lets an admin retry', async () => {
    api.docsApi.list.mockResolvedValue(list([doc({ status: 'failed', error_message: 'The PDF is password-protected.' })]));
    api.docsApi.retry.mockResolvedValue(doc({ status: 'pending' }));
    renderApp(page, { route: '/kb', user: ADMIN });
    expect(await screen.findByText(/password-protected/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Retry indexing Fees.pdf/ }));
    await waitFor(() => expect(api.docsApi.retry).toHaveBeenCalledWith('d1'));
  });

  it('deletes only after the admin confirms', async () => {
    api.docsApi.list.mockResolvedValueOnce(list([doc()])).mockResolvedValue(list([]));
    api.docsApi.remove.mockResolvedValue();
    renderApp(page, { route: '/kb', user: ADMIN });
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Fees.pdf' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/7 search chunk/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(api.docsApi.remove).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Delete Fees.pdf' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete document' }));
    await waitFor(() => expect(api.docsApi.remove).toHaveBeenCalledWith('d1'));
    expect(await screen.findByText('No documents yet')).toBeInTheDocument();
  });

  it('cannot delete a document that is still processing', async () => {
    api.docsApi.list.mockResolvedValue(list([doc({ status: 'processing', chunk_count: 0 })]));
    renderApp(page, { route: '/kb', user: ADMIN });
    expect(await screen.findByRole('button', { name: 'Delete Fees.pdf' })).toBeDisabled();
    expect(screen.getByText('Processing', { selector: 'span' })).toBeInTheDocument();
  });

  it('polls while a document is being indexed and stops when it is done', async () => {
    api.docsApi.list.mockResolvedValueOnce(list([doc({ status: 'processing', chunk_count: 0 })])).mockResolvedValue(list([doc()]));
    renderApp(page, { route: '/kb', user: ADMIN });
    expect(await screen.findByText('Processing', { selector: 'span' })).toBeInTheDocument();
    expect(await screen.findByText('Indexed', { selector: 'span' }, { timeout: 5000 })).toBeInTheDocument();
    const calls = api.docsApi.list.mock.calls.length;
    await new Promise((r) => setTimeout(r, 3000));
    expect(api.docsApi.list.mock.calls.length).toBe(calls);               // no more polling once everything is indexed
  }, 12000);

  it('filters by search text, category and status', async () => {
    api.docsApi.list.mockResolvedValue(list([doc()]));
    renderApp(page, { route: '/kb', user: STUDENT });
    await screen.findByText('Fees.pdf');
    await userEvent.type(screen.getByLabelText('Search documents'), 'fee');
    await userEvent.selectOptions(screen.getByLabelText('Filter by category'), 'Syllabus');
    await userEvent.selectOptions(screen.getByLabelText('Filter by status'), 'failed');
    await waitFor(() => expect(api.docsApi.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'fee', category: 'Syllabus', status: 'failed', page: 1 })));
  });

  it('shows an empty state for no results and an error state with retry', async () => {
    api.docsApi.list.mockRejectedValueOnce(axiosError(500, {})).mockResolvedValue(list([]));
    renderApp(page, { route: '/kb', user: STUDENT });
    expect(await screen.findByText(/server had a problem/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No documents yet')).toBeInTheDocument();
    expect(screen.getByText(/has not uploaded any documents/)).toBeInTheDocument();
  });

  it('validates the file in the upload dialog and uploads with the chosen category', async () => {
    api.docsApi.list.mockResolvedValue(list([]));
    api.docsApi.upload.mockResolvedValue(doc({ status: 'pending' }));
    renderApp(page, { route: '/kb', user: ADMIN });
    await userEvent.click((await screen.findAllByRole('button', { name: /Upload document/ }))[0]);
    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByLabelText('PDF file');
    await userEvent.upload(input, new File(['hello'], 'notes.txt', { type: 'text/plain' }), { applyAccept: false });
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Only PDF files are accepted.');
    expect(within(dialog).getByRole('button', { name: 'Upload and index' })).toBeDisabled();

    await userEvent.upload(input, new File(['%PDF-1.4 data'], 'fees.pdf', { type: 'application/pdf' }));
    expect(within(dialog).getByText('fees.pdf')).toBeInTheDocument();
    await userEvent.selectOptions(within(dialog).getByLabelText('Category'), 'Fee Structure');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Upload and index' }));
    await waitFor(() => expect(api.docsApi.upload).toHaveBeenCalledTimes(1));
    expect(api.docsApi.upload.mock.calls[0][0].name).toBe('fees.pdf');
    expect(api.docsApi.upload.mock.calls[0][1]).toBe('Fee Structure');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows the server message when an upload is rejected (duplicate)', async () => {
    api.docsApi.list.mockResolvedValue(list([]));
    api.docsApi.upload.mockRejectedValue(axiosError(409, { detail: "This file was already uploaded as 'Fees.pdf' (status: indexed)." }));
    renderApp(page, { route: '/kb', user: ADMIN });
    await userEvent.click((await screen.findAllByRole('button', { name: /Upload document/ }))[0]);
    const dialog = await screen.findByRole('dialog');
    await userEvent.upload(within(dialog).getByLabelText('PDF file'), new File(['%PDF-1.4'], 'fees.pdf', { type: 'application/pdf' }));
    await userEvent.selectOptions(within(dialog).getByLabelText('Category'), 'Fee Structure');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Upload and index' }));
    expect(await within(dialog).findByText(/already uploaded/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Upload and index' })).toBeEnabled();         // user can fix and retry
  });
});
