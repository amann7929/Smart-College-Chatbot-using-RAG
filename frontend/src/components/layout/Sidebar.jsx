import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen, ChevronsUpDown, LayoutDashboard, LogOut, MessageSquare, Moon, Pencil, Plus, Search, Settings, Sun, Trash2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useChats } from '../../context/ChatContext';
import { Avatar, Logo, Skeleton } from '../ui/Feedback';
import { Button, IconButton } from '../ui/Button';
import { timeAgo } from '../../lib/format';

const linkCls = ({ isActive }) =>
  `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
    isActive ? 'bg-brand-50 text-brand-700 dark:bg-navy-800 dark:text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-navy-800/70'}`;

function ChatHistory({ onNavigate }) {
  const { chats, loading, error, search, setSearch, activeId, requestRename, deleteChat, refreshChats } = useChats();
  const navigate = useNavigate();

  return (
    <div className="mt-4 flex min-h-0 flex-1 flex-col border-t border-slate-200 pt-4 dark:border-navy-800">
      <Button icon={Plus} className="w-full" onClick={() => { navigate('/chat'); onNavigate?.(); }}>New chat</Button>
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input type="search" aria-label="Search chat history" placeholder="Search chats" value={search}
          onChange={(e) => setSearch(e.target.value)} className="input h-9 py-0 pl-9 text-[13px]" />
      </div>
      <p className="mb-1.5 mt-4 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">History</p>
      <nav aria-label="Chat history" className="-mx-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1">
        {loading && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="mx-2 my-2 h-8" />)}
        {!loading && error && (
          <div className="px-3 py-2 text-xs text-red-600 dark:text-red-400">{error}{' '}
            <button type="button" className="underline" onClick={refreshChats}>Retry</button></div>
        )}
        {!loading && !error && chats.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-slate-400">{search ? 'No chats match your search.' : 'No chats yet. Ask your first question!'}</p>
        )}
        {chats.map((c) => (
          <div key={c.id} className={`group flex items-center rounded-xl pr-1 ${activeId === c.id ? 'bg-brand-50 dark:bg-navy-800' : 'hover:bg-slate-100 dark:hover:bg-navy-800/70'}`}>
            <Link to={`/chat/${c.id}`} onClick={onNavigate} aria-current={activeId === c.id ? 'page' : undefined}
              className="min-w-0 flex-1 rounded-xl px-3 py-2">
              <span className={`block truncate text-[13px] font-medium ${activeId === c.id ? 'text-brand-700 dark:text-white' : 'text-slate-700 dark:text-slate-200'}`}>{c.title}</span>
              <span className="block text-[11px] text-slate-400">{timeAgo(c.updated_at)}</span>
            </Link>
            <span className="flex opacity-0 transition group-focus-within:opacity-100 group-hover:opacity-100">
              <IconButton label={`Rename ${c.title}`} icon={Pencil} className="h-7 w-7" onClick={() => requestRename(c)} />
              <IconButton label={`Delete ${c.title}`} icon={Trash2} className="h-7 w-7 hover:text-red-600" onClick={() => deleteChat(c)} />
            </span>
          </div>
        ))}
      </nav>
    </div>
  );
}

function ProfileMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {open && (
        <div role="menu" className="card absolute bottom-full left-0 right-0 mb-2 overflow-hidden p-1.5 shadow-lg">
          <button role="menuitem" type="button" onClick={() => { setOpen(false); navigate('/settings'); }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-navy-800">
            <Settings className="h-4 w-4" aria-hidden /> Settings
          </button>
          <button role="menuitem" type="button" onClick={async () => { setOpen(false); await logout(); navigate('/login', { replace: true }); }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40">
            <LogOut className="h-4 w-4" aria-hidden /> Sign out
          </button>
        </div>
      )}
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label="Open profile menu" onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-slate-100 dark:hover:bg-navy-800">
        <Avatar name={user.full_name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{user.full_name}</span>
          <span className="block truncate text-xs capitalize text-slate-500 dark:text-slate-400">{user.role}</span>
        </span>
        <ChevronsUpDown className="h-4 w-4 text-slate-400" aria-hidden />
      </button>
    </div>
  );
}

export default function Sidebar({ open, onClose }) {
  const { isAdmin } = useAuth();
  const { theme, toggle } = useTheme();
  const { pathname } = useLocation();
  const onChatRoute = pathname === '/chat' || pathname.startsWith('/chat/');

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-navy-950/50 backdrop-blur-sm lg:hidden" onClick={onClose} aria-hidden />}
      <aside aria-label="Sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-200 bg-white p-4 transition-transform duration-200 dark:border-navy-800 dark:bg-navy-900 lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-5 flex items-center justify-between">
          <Link to="/" aria-label="ClgBot home"><Logo /></Link>
          <div className="flex items-center gap-1">
            <IconButton label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} icon={theme === 'dark' ? Sun : Moon} onClick={toggle} />
            <IconButton label="Close sidebar" icon={X} className="lg:hidden" onClick={onClose} />
          </div>
        </div>
        <nav aria-label="Main" className="space-y-1">
          <NavLink to="/chat" className={() => linkCls({ isActive: onChatRoute })} onClick={onClose}><MessageSquare className="h-[18px] w-[18px]" aria-hidden /> Chat</NavLink>
          {isAdmin && <NavLink to="/knowledge-base" className={linkCls} onClick={onClose}><BookOpen className="h-[18px] w-[18px]" aria-hidden /> Knowledge Base</NavLink>}
          {isAdmin && <NavLink to="/admin" className={linkCls} onClick={onClose}><LayoutDashboard className="h-[18px] w-[18px]" aria-hidden /> Admin Dashboard</NavLink>}
          <NavLink to="/settings" className={linkCls} onClick={onClose}><Settings className="h-[18px] w-[18px]" aria-hidden /> Settings</NavLink>
        </nav>
        {onChatRoute ? <ChatHistory onNavigate={onClose} /> : <div className="flex-1" />}
        <div className="mt-3 border-t border-slate-200 pt-3 dark:border-navy-800"><ProfileMenu /></div>
      </aside>
    </>
  );
}
