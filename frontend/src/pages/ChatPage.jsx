import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bot, Eraser, Pencil, Sparkles, Trash2 } from 'lucide-react';
import { chatsApi, errorMessage } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import { useChats } from '../context/ChatContext';
import MessageItem, { TypingIndicator } from '../components/chat/MessageItem';
import Composer from '../components/chat/Composer';
import { ErrorState, Skeleton } from '../components/ui/Feedback';
import { IconButton } from '../components/ui/Button';
import { SUGGESTED_QUESTIONS } from '../lib/constants';
import { useDocumentTitle } from '../lib/useDocumentTitle';

const DEFAULT_PREFS = { show_sources: true, compact_mode: false, auto_scroll: true };

export default function ChatPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const { chats, refreshChats, requestRename, deleteChat } = useChats();
  const prefs = { ...DEFAULT_PREFS, ...(user.chat_preferences || {}) };

  const [messages, setMessages] = useState([]);
  const [fallbackTitle, setFallbackTitle] = useState('New chat');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [sending, setSending] = useState(false);
  const [retryingId, setRetryingId] = useState(null);
  const [input, setInput] = useState('');
  const endRef = useRef(null);
  const skipLoad = useRef(null);      // chat id we just created ourselves: its messages are already on screen
  const createdRef = useRef(null);    // chat created for a first message whose send failed (reused on retry)
  const viewKey = useRef(0);          // changes whenever the user switches chats, to drop stale responses

  const listed = chats.find((c) => c.id === chatId);
  const title = listed?.title || fallbackTitle;
  useDocumentTitle(chatId ? title : 'Chat');

  const loadChat = useCallback(async (id, key) => {
    setLoading(true); setLoadError('');
    try {
      const detail = await chatsApi.get(id);
      if (viewKey.current !== key) return;
      setMessages(detail.messages); setFallbackTitle(detail.title);
    } catch (e) {
      if (viewKey.current === key) setLoadError(errorMessage(e, 'Could not load this chat.'));
    } finally {
      if (viewKey.current === key) setLoading(false);
    }
  }, []);

  useEffect(() => {
    viewKey.current += 1;
    const key = viewKey.current;
    setSending(false); setRetryingId(null);
    if (!chatId) { setMessages([]); setFallbackTitle('New chat'); setLoadError(''); return; }
    createdRef.current = null;
    if (skipLoad.current === chatId) { skipLoad.current = null; return; }
    loadChat(chatId, key);
  }, [chatId, loadChat]);

  useEffect(() => {
    // Not on the welcome screen: scrolling to the bottom there would hide the greeting on small screens.
    if (prefs.auto_scroll && (messages.length > 0 || sending)) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, sending, prefs.auto_scroll]);

  const send = async (text, resendOf) => {
    const content = text.trim();
    if (!content || sending) return;
    const key = viewKey.current;
    const tempId = resendOf?.id || `tmp-${Date.now()}`;
    setSending(true);
    setMessages((m) => (resendOf
      ? m.map((x) => (x.id === tempId ? { ...x, sendError: null } : x))
      : [...m, { id: tempId, role: 'user', content, status: 'completed', created_at: new Date().toISOString() }]));
    if (!resendOf) setInput('');
    try {
      let id = chatId || createdRef.current;
      if (!id) { id = (await chatsApi.create()).id; createdRef.current = id; }
      const res = await chatsApi.send(id, content);
      refreshChats();
      if (viewKey.current !== key) return;           // user moved to another chat meanwhile
      setMessages((m) => [...m.filter((x) => x.id !== tempId), res.user_message, res.assistant_message]);
      setFallbackTitle(res.chat.title);
      if (!chatId) { skipLoad.current = id; createdRef.current = null; navigate(`/chat/${id}`, { replace: true }); }
    } catch (e) {
      if (viewKey.current !== key) return;
      const msg = errorMessage(e);
      setMessages((m) => m.map((x) => (x.id === tempId ? { ...x, sendError: msg } : x)));
      toast.error(msg);
    } finally {
      if (viewKey.current === key) setSending(false);
    }
  };

  const retryAnswer = async (msg) => {
    const key = viewKey.current;
    setRetryingId(msg.id);
    try {
      const updated = await chatsApi.retry(chatId, msg.id);
      if (viewKey.current === key) setMessages((m) => m.map((x) => (x.id === msg.id ? updated : x)));
    } catch (e) {
      toast.error(errorMessage(e, 'Retry failed.'));
    } finally {
      if (viewKey.current === key) setRetryingId(null);
    }
  };

  const feedback = async (msg, rating) => {
    const prev = msg.my_feedback ?? null;
    const next = prev === rating ? null : rating;
    const set = (v) => setMessages((m) => m.map((x) => (x.id === msg.id ? { ...x, my_feedback: v } : x)));
    set(next);
    try {
      if (next === null) await chatsApi.removeFeedback(msg.id); else await chatsApi.setFeedback(msg.id, next);
      if (next !== null) toast.success('Thanks for your feedback!');
    } catch (e) {
      set(prev);
      toast.error(errorMessage(e, 'Could not save your feedback.'));
    }
  };

  const clearChat = async () => {
    const ok = await confirm({ title: 'Clear this chat?', message: 'All messages in this chat will be deleted. The chat itself stays in your history.', confirmText: 'Clear messages', danger: true });
    if (!ok) return;
    try { await chatsApi.clear(chatId); setMessages([]); toast.success('Chat cleared.'); refreshChats(); }
    catch (e) { toast.error(errorMessage(e, 'Could not clear the chat.')); }
  };

  const showWelcome = !loading && !loadError && messages.length === 0 && !sending;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur dark:border-navy-800 dark:bg-navy-950/80 sm:px-6">
        <h1 className="truncate text-sm font-semibold text-slate-900 dark:text-white">{chatId ? title : 'New chat'}</h1>
        {chatId && (
          <div className="flex items-center">
            <IconButton label="Rename chat" icon={Pencil} onClick={() => requestRename({ id: chatId, title })} />
            <IconButton label="Clear chat" icon={Eraser} disabled={messages.length === 0} onClick={clearChat} />
            <IconButton label="Delete chat" icon={Trash2} className="hover:!text-red-600" onClick={() => deleteChat({ id: chatId, title })} />
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto" aria-live="polite" aria-busy={loading}>
        <div className={`mx-auto max-w-3xl px-4 py-6 sm:px-6 ${prefs.compact_mode ? 'space-y-3' : 'space-y-6'}`}>
          {loading && (
            <div className="space-y-6" aria-label="Loading messages">
              <Skeleton className="ml-auto h-12 w-2/3" /><Skeleton className="h-28 w-5/6" /><Skeleton className="ml-auto h-10 w-1/2" />
            </div>
          )}
          {loadError && <ErrorState message={loadError} onRetry={() => loadChat(chatId, viewKey.current)} />}
          {showWelcome && (
            <div className="flex flex-col items-center pt-8 text-center sm:pt-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-violet-600 text-white shadow-pop"><Bot className="h-8 w-8" aria-hidden /></div>
              <h2 className="mt-5 text-2xl font-bold tracking-tight text-navy-900 dark:text-white">Hi {user.full_name.split(' ')[0]}, how can I help?</h2>
              <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">Ask about admissions, fees, hostel, exams, placements and more. I answer only from the college documents in the knowledge base.</p>
              <div className="mt-8 grid w-full gap-2.5 sm:grid-cols-2">
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <button key={q} type="button" onClick={() => send(q)}
                    className={`card items-start gap-2.5 p-3.5 text-left text-sm text-slate-700 transition hover:border-brand-300 hover:shadow-pop dark:text-slate-200 dark:hover:border-brand-500 ${i >= 4 ? 'hidden sm:flex' : 'flex'}`}>
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" aria-hidden />{q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <MessageItem key={m.id} message={m} prefs={prefs} onRetry={retryAnswer} retrying={retryingId === m.id}
              onFeedback={feedback} onResend={(msg) => send(msg.content, msg)} sendingLocked={sending} />
          ))}
          {sending && <TypingIndicator />}
          <div ref={endRef} />
        </div>
      </div>

      <Composer value={input} onChange={setInput} onSubmit={() => send(input)} disabled={sending || loading} />
    </div>
  );
}
