import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Outlet, Route, Routes } from 'react-router-dom';
import ChatPage from './ChatPage';
import { ChatProvider } from '../context/ChatContext';
import { ProtectedRoute } from '../components/layout/RouteGuards';
import * as api from '../api';
import { STUDENT, axiosError, renderApp } from '../test/utils';

vi.mock('../api', async () => (await import('../test/apiMock.js')).createApiMock());

const tree = (
  <Routes>
    <Route element={<ProtectedRoute><ChatProvider><Outlet /></ChatProvider></ProtectedRoute>}>
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/chat/:chatId" element={<ChatPage />} />
    </Route>
  </Routes>
);

const SOURCE = { id: 'S1', document_id: 'd1', filename: 'SAMPLE_Hostel_Facilities.pdf', category: 'Hostel Facilities', page_start: 1, page_end: 1, chunk_index: 0, similarity: 0.61, snippet: 'The hostel gate closes at 10 pm.', cited: true };
const msg = (over) => ({ id: 'm', session_id: 'c1', role: 'assistant', content: '', status: 'completed', sources: null, retrieval_meta: null, created_at: '2026-06-01T10:00:00Z', my_feedback: null, ...over });
const answer = (over = {}) => msg({ id: 'a1', content: 'The gate closes at **10 pm**. [S1]', sources: [SOURCE], retrieval_meta: { llm_called: true, used: 1 }, ...over });
const reply = (a) => ({ chat: { id: 'c1', title: 'When does the gate close?', created_at: '', updated_at: '' }, user_message: msg({ id: 'u1', role: 'user', content: 'When does the gate close?' }), assistant_message: a });

beforeEach(() => {
  vi.clearAllMocks();
  api.chatsApi.list.mockResolvedValue([]);
  api.chatsApi.create.mockResolvedValue({ id: 'c1', title: 'New chat' });
});

describe('Chat page', () => {
  it('greets the user and offers suggested questions', async () => {
    renderApp(tree, { route: '/chat', user: STUDENT });
    expect(await screen.findByRole('heading', { name: /Hi Riya, how can I help/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /What time does the hostel gate close/ })).toBeInTheDocument();
  });

  it('asks a question: creates the chat, shows markdown answer, sources and timestamp', async () => {
    api.chatsApi.send.mockResolvedValue(reply(answer()));
    renderApp(tree, { route: '/chat', user: STUDENT });
    await userEvent.type(await screen.findByLabelText('Ask a question about the college'), 'When does the gate close?');
    await userEvent.click(screen.getByRole('button', { name: 'Send question' }));

    expect(await screen.findByText('10 pm', { selector: 'strong' })).toBeInTheDocument();      // markdown bold rendered
    expect(api.chatsApi.create).toHaveBeenCalledTimes(1);
    expect(api.chatsApi.send).toHaveBeenCalledWith('c1', 'When does the gate close?');
    expect(screen.getByText('[S1]')).toBeInTheDocument();                                         // citation marker badge
    await userEvent.click(screen.getByRole('button', { name: /Sources \(1\)/ }));
    expect(screen.getByText('SAMPLE_Hostel_Facilities.pdf')).toBeVisible();
    expect(screen.getByText('Cited in answer')).toBeInTheDocument();
    expect(screen.getByText('similarity 0.61')).toBeInTheDocument();
    expect(screen.getAllByRole('time').length).toBeGreaterThanOrEqual(2);                         // timestamps on both messages
    expect(screen.getByLabelText('Ask a question about the college')).toHaveValue('');
  });

  it('sends with Enter and keeps Shift+Enter for new lines', async () => {
    api.chatsApi.send.mockResolvedValue(reply(answer()));
    renderApp(tree, { route: '/chat', user: STUDENT });
    const box = await screen.findByLabelText('Ask a question about the college');
    await userEvent.type(box, 'line one{Shift>}{Enter}{/Shift}line two');
    expect(box).toHaveValue('line one\nline two');
    expect(api.chatsApi.send).not.toHaveBeenCalled();
    await userEvent.type(box, '{Enter}');
    await waitFor(() => expect(api.chatsApi.send).toHaveBeenCalledWith('c1', 'line one\nline two'));
  });

  it('clicking a suggested question sends it', async () => {
    api.chatsApi.send.mockResolvedValue(reply(answer()));
    renderApp(tree, { route: '/chat', user: STUDENT });
    await userEvent.click(await screen.findByRole('button', { name: /library/ }));
    await waitFor(() => expect(api.chatsApi.send).toHaveBeenCalledWith('c1', 'How many books can I borrow from the library?'));
  });

  it('disables sending for blank input and shows the character counter', async () => {
    renderApp(tree, { route: '/chat', user: STUDENT });
    const send = await screen.findByRole('button', { name: 'Send question' });
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Ask a question about the college'), '   ');
    expect(send).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Ask a question about the college'), 'hello');
    expect(send).toBeEnabled();
    expect(screen.getByText('8/2000')).toBeInTheDocument();
  });

  it('copies an answer to the clipboard', async () => {
    api.chatsApi.get.mockResolvedValue({ id: 'c1', title: 'Gate', messages: [msg({ id: 'u1', role: 'user', content: 'q' }), answer()] });
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderApp(tree, { route: '/chat/c1', user: STUDENT });
    await userEvent.click(await screen.findByRole('button', { name: 'Copy answer' }));
    expect(writeText).toHaveBeenCalledWith('The gate closes at **10 pm**. [S1]');
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('submits, switches and removes feedback', async () => {
    api.chatsApi.get.mockResolvedValue({ id: 'c1', title: 'Gate', messages: [answer()] });
    api.chatsApi.setFeedback.mockResolvedValue({});
    api.chatsApi.removeFeedback.mockResolvedValue({});
    renderApp(tree, { route: '/chat/c1', user: STUDENT });
    const up = await screen.findByRole('button', { name: 'Helpful answer' });
    await userEvent.click(up);
    expect(api.chatsApi.setFeedback).toHaveBeenCalledWith('a1', 1);
    await waitFor(() => expect(up).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.click(screen.getByRole('button', { name: 'Not helpful' }));
    expect(api.chatsApi.setFeedback).toHaveBeenLastCalledWith('a1', -1);
    await userEvent.click(screen.getByRole('button', { name: 'Not helpful' }));          // toggling off removes it
    expect(api.chatsApi.removeFeedback).toHaveBeenCalledWith('a1');
  });

  it('reverts feedback when the server rejects it', async () => {
    api.chatsApi.get.mockResolvedValue({ id: 'c1', title: 'Gate', messages: [answer()] });
    api.chatsApi.setFeedback.mockRejectedValue(axiosError(500, {}));
    renderApp(tree, { route: '/chat/c1', user: STUDENT });
    const up = await screen.findByRole('button', { name: 'Helpful answer' });
    await userEvent.click(up);
    await waitFor(() => expect(up).toHaveAttribute('aria-pressed', 'false'));
  });

  it('shows a failed answer with its reason and retries it in place', async () => {
    const failed = answer({ id: 'a1', status: 'failed', content: 'The AI service is receiving too many requests right now.', sources: null, retrieval_meta: { error_code: 'rate_limited' } });
    api.chatsApi.get.mockResolvedValue({ id: 'c1', title: 'Gate', messages: [msg({ id: 'u1', role: 'user', content: 'q' }), failed] });
    api.chatsApi.retry.mockResolvedValue(answer({ id: 'a1', content: 'Recovered: **10 pm**.' }));
    renderApp(tree, { route: '/chat/c1', user: STUDENT });
    expect(await screen.findByText(/too many requests/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy answer' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry answer' }));
    expect(api.chatsApi.retry).toHaveBeenCalledWith('c1', 'a1');
    expect(await screen.findByText(/Recovered/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry answer' })).not.toBeInTheDocument();
  });

  it('does not show retrieval diagnostics when no document matched', async () => {
    const none = answer({ content: 'The uploaded documents do not contain sufficient information to answer this question.', sources: null, retrieval_meta: { llm_called: false, used: 0 } });
    api.chatsApi.get.mockResolvedValue({ id: 'c1', title: 'Q', messages: [none] });
    renderApp(tree, { route: '/chat/c1', user: STUDENT });
    expect(await screen.findByText(/do not contain sufficient information/)).toBeInTheDocument();
    expect(screen.queryByText(/no AI model was used/)).not.toBeInTheDocument();
    expect(screen.queryByText(/No passage in the uploaded documents/)).not.toBeInTheDocument();
  });

  it('keeps the question and offers to resend when sending fails', async () => {
    api.chatsApi.send.mockRejectedValueOnce(axiosError(429, { detail: 'You are sending messages too quickly. Please wait a moment.' }))
      .mockResolvedValueOnce(reply(answer()));
    renderApp(tree, { route: '/chat', user: STUDENT });
    await userEvent.type(await screen.findByLabelText('Ask a question about the college'), 'When does the gate close?');
    await userEvent.click(screen.getByRole('button', { name: 'Send question' }));
    expect(await screen.findByText(/Not sent: You are sending messages too quickly/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry send' }));
    expect(await screen.findByText('10 pm', { selector: 'strong' })).toBeInTheDocument();
    expect(api.chatsApi.create).toHaveBeenCalledTimes(1);                       // the chat created for the first attempt is reused
    expect(api.chatsApi.send).toHaveBeenCalledTimes(2);
  });

  it('hides sources when the user turned them off', async () => {
    api.chatsApi.get.mockResolvedValue({ id: 'c1', title: 'Gate', messages: [answer()] });
    renderApp(tree, { route: '/chat/c1', user: { ...STUDENT, chat_preferences: { show_sources: false } } });
    expect(await screen.findByText('10 pm', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sources/ })).not.toBeInTheDocument();
  });

  it('shows an error state with retry when a chat cannot be loaded', async () => {
    api.chatsApi.get.mockRejectedValueOnce(axiosError(404, { detail: 'Chat not found.' })).mockResolvedValueOnce({ id: 'c1', title: 'Gate', messages: [answer()] });
    renderApp(tree, { route: '/chat/c1', user: STUDENT });
    expect(await screen.findByText('Chat not found.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('10 pm', { selector: 'strong' })).toBeInTheDocument();
  });

  it('clears a chat only after confirmation', async () => {
    api.chatsApi.get.mockResolvedValue({ id: 'c1', title: 'Gate', messages: [answer()] });
    api.chatsApi.clear.mockResolvedValue();
    renderApp(tree, { route: '/chat/c1', user: STUDENT });
    await userEvent.click(await screen.findByRole('button', { name: 'Clear chat' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.chatsApi.clear).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Clear chat' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Clear messages' }));
    await waitFor(() => expect(api.chatsApi.clear).toHaveBeenCalledWith('c1'));
    expect(await screen.findByRole('heading', { name: /how can I help/ })).toBeInTheDocument();
  });

  it('renames a chat from the header', async () => {
    api.chatsApi.list.mockResolvedValue([{ id: 'c1', title: 'Gate', created_at: '', updated_at: '' }]);
    api.chatsApi.get.mockResolvedValue({ id: 'c1', title: 'Gate', messages: [answer()] });
    api.chatsApi.rename.mockResolvedValue({});
    renderApp(tree, { route: '/chat/c1', user: STUDENT });
    await userEvent.click(await screen.findByRole('button', { name: 'Rename chat' }));
    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByLabelText('Chat title');
    await userEvent.clear(input);
    await userEvent.type(input, 'Hostel timings');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.chatsApi.rename).toHaveBeenCalledWith('c1', 'Hostel timings'));
    expect(await screen.findByRole('heading', { name: 'Hostel timings' })).toBeInTheDocument();
  });

  it('deletes a chat after confirmation and returns to a new chat', async () => {
    api.chatsApi.list.mockResolvedValue([{ id: 'c1', title: 'Gate', created_at: '', updated_at: '' }]);
    api.chatsApi.get.mockResolvedValue({ id: 'c1', title: 'Gate', messages: [answer()] });
    api.chatsApi.remove.mockResolvedValue();
    renderApp(tree, { route: '/chat/c1', user: STUDENT });
    await userEvent.click(await screen.findByRole('button', { name: 'Delete chat' }));
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete chat' }));
    await waitFor(() => expect(api.chatsApi.remove).toHaveBeenCalledWith('c1'));
    expect(await screen.findByRole('heading', { name: /how can I help/ })).toBeInTheDocument();
  });
});

describe('Modal focus (regression)', () => {
  it('keeps focus in the field while typing quickly in the rename dialog', async () => {
    api.chatsApi.list.mockResolvedValue([{ id: 'c1', title: 'Gate', created_at: '', updated_at: '' }]);
    api.chatsApi.get.mockResolvedValue({ id: 'c1', title: 'Gate', messages: [answer()] });
    renderApp(tree, { route: '/chat/c1', user: STUDENT });
    await userEvent.click(await screen.findByRole('button', { name: 'Rename chat' }));
    const input = within(await screen.findByRole('dialog')).getByLabelText('Chat title');
    await userEvent.clear(input);
    await userEvent.type(input, 'abcdefghij');          // many re-renders in a row, no pauses
    expect(input).toHaveValue('abcdefghij');
    expect(input).toHaveFocus();
  });
});

describe('Scrolling', () => {
  it('does not auto-scroll on the welcome screen, but does once messages exist', async () => {
    const spy = vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    api.chatsApi.send.mockResolvedValue(reply(answer()));
    renderApp(tree, { route: '/chat', user: STUDENT });
    await screen.findByRole('heading', { name: /how can I help/ });
    expect(spy).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Ask a question about the college'), 'When does the gate close?');
    await userEvent.click(screen.getByRole('button', { name: 'Send question' }));
    await screen.findByText('10 pm', { selector: 'strong' });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
