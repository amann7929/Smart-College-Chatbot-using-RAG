import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import { chatsApi, errorMessage } from '../api';
import { useToast } from './ToastContext';
import { useConfirm } from './ConfirmContext';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { TextInput } from '../components/ui/Form';

const ChatContext = createContext(null);

export function ChatProvider({ children }) {
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const match = useMatch('/chat/:chatId');
  const activeId = match?.params.chatId || null;

  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [renaming, setRenaming] = useState(null); // {id, title}
  const [renameValue, setRenameValue] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);
  const searchRef = useRef(search);
  searchRef.current = search;

  const refreshChats = useCallback(async () => {
    try {
      const q = searchRef.current.trim();
      setChats(await chatsApi.list({ q: q || undefined, limit: 100 }));
      setError('');
    } catch (e) {
      setError(errorMessage(e, 'Could not load your chats.'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search; also the initial load
  useEffect(() => {
    const t = setTimeout(refreshChats, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search, refreshChats]);

  const requestRename = useCallback((chat) => { setRenaming(chat); setRenameValue(chat.title); }, []);

  const submitRename = async (e) => {
    e.preventDefault();
    const title = renameValue.trim();
    if (!title) return;
    setRenameBusy(true);
    try {
      await chatsApi.rename(renaming.id, title);
      setChats((list) => list.map((c) => (c.id === renaming.id ? { ...c, title } : c)));
      toast.success('Chat renamed.');
      setRenaming(null);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not rename the chat.'));
    } finally {
      setRenameBusy(false);
    }
  };

  const deleteChat = useCallback(async (chat) => {
    const ok = await confirm({
      title: 'Delete this chat?', message: `"${chat.title}" and all of its messages will be permanently deleted.`,
      confirmText: 'Delete chat', danger: true,
    });
    if (!ok) return false;
    try {
      await chatsApi.remove(chat.id);
      setChats((list) => list.filter((c) => c.id !== chat.id));
      toast.success('Chat deleted.');
      if (activeId === chat.id) navigate('/chat', { replace: true });
      return true;
    } catch (err) {
      toast.error(errorMessage(err, 'Could not delete the chat.'));
      return false;
    }
  }, [confirm, toast, navigate, activeId]);

  const value = useMemo(() => ({
    chats, loading, error, search, setSearch, refreshChats, activeId, requestRename, deleteChat,
  }), [chats, loading, error, search, refreshChats, activeId, requestRename, deleteChat]);

  return (
    <ChatContext.Provider value={value}>
      {children}
      <Modal open={!!renaming} onClose={() => setRenaming(null)} title="Rename chat" size="sm">
        <form onSubmit={submitRename} className="space-y-4">
          <TextInput label="Chat title" value={renameValue} maxLength={200} onChange={(e) => setRenameValue(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRenaming(null)}>Cancel</Button>
            <Button type="submit" loading={renameBusy} disabled={!renameValue.trim()}>Save</Button>
          </div>
        </form>
      </Modal>
    </ChatContext.Provider>
  );
}

export function useChats() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChats must be used inside <ChatProvider>');
  return ctx;
}
