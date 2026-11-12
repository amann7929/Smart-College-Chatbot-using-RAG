import { useEffect, useState } from 'react';
import { Search, Trash2, UserCheck, UserX, Users } from 'lucide-react';
import { adminApi, errorMessage } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { Avatar, Badge, EmptyState, ErrorState, Skeleton } from '../ui/Feedback';
import { Button } from '../ui/Button';
import { formatDate } from '../../lib/format';
import { useFetch } from '../../lib/useFetch';

const PAGE_SIZE = 8;

export default function UsersTable({ onChanged }) {
  const { user: me } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => { const t = setTimeout(() => { setSearch(input.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [input]);
  const { data, loading, error, reload } = useFetch(
    () => adminApi.users({ search: search || undefined, role: role || undefined, page, page_size: PAGE_SIZE }),
    [search, role, page],
  );

  const act = async (u, fn, success) => {
    setBusyId(u.id);
    try { await fn(); toast.success(success); await reload(true); onChanged?.(); }
    catch (e) { toast.error(errorMessage(e)); }
    finally { setBusyId(null); }
  };

  const changeRole = async (u, next) => {
    const ok = await confirm({ title: `Change role to ${next}?`, message: `${u.full_name} will ${next === 'admin' ? 'get full administrator access' : 'lose administrator access'}.`, confirmText: 'Change role' });
    if (ok) act(u, () => adminApi.updateUser(u.id, { role: next }), `${u.full_name} is now ${next === 'admin' ? 'an admin' : 'a student'}.`);
  };
  const toggleActive = async (u) => {
    const next = !u.is_active;
    const ok = await confirm({
      title: next ? 'Reactivate account?' : 'Deactivate account?',
      message: next ? `${u.full_name} will be able to sign in again.` : `${u.full_name} will be signed out immediately and cannot sign in until reactivated.`,
      confirmText: next ? 'Reactivate' : 'Deactivate', danger: !next,
    });
    if (ok) act(u, () => adminApi.updateUser(u.id, { is_active: next }), next ? 'Account reactivated.' : 'Account deactivated.');
  };
  const remove = async (u) => {
    const ok = await confirm({ title: 'Delete this user?', message: `${u.full_name} (${u.email}) and all of their chats will be permanently deleted.`, confirmText: 'Delete user', danger: true });
    if (ok) act(u, () => adminApi.deleteUser(u.id), 'User deleted.');
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <section className="card overflow-hidden" aria-labelledby="users-title">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5 dark:border-navy-800">
        <h2 id="users-title" className="text-base font-semibold text-slate-900 dark:text-white">User management</h2>
        <div className="flex flex-1 flex-wrap justify-end gap-2">
          <div className="relative min-w-[12rem] max-w-xs flex-1">
            <label htmlFor="user-search" className="sr-only">Search users</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input id="user-search" type="search" className="input h-10 py-0 pl-9" placeholder="Search name or email" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          <select aria-label="Filter by role" className="input h-10 w-auto py-0" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}>
            <option value="">All roles</option><option value="student">Students</option><option value="admin">Admins</option>
          </select>
        </div>
      </div>
      {loading && <div className="space-y-3 p-5">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>}
      {!loading && error && <ErrorState message={error} onRetry={() => reload()} />}
      {!loading && !error && data?.items.length === 0 && <EmptyState icon={Users} title="No users found" description="Try a different search." />}
      {!loading && !error && data?.items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-navy-950/50 dark:text-slate-400">
              <tr><th className="px-5 py-3 font-semibold">User</th><th className="px-3 py-3 font-semibold">Role</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 font-semibold">Joined</th><th className="px-5 py-3 text-right font-semibold">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-navy-800">
              {data.items.map((u) => {
                const self = u.id === me.id;
                return (
                  <tr key={u.id}>
                    <td className="px-5 py-3"><div className="flex items-center gap-3"><Avatar name={u.full_name} size="sm" />
                      <div className="min-w-0"><p className="truncate font-medium text-slate-900 dark:text-white">{u.full_name}{self && <span className="ml-1.5 text-xs text-slate-400">(you)</span>}</p><p className="truncate text-xs text-slate-500">{u.email}</p></div></div></td>
                    <td className="px-3 py-3">
                      <select aria-label={`Role for ${u.full_name}`} className="input h-8 w-auto py-0 text-xs" value={u.role} disabled={self || busyId === u.id} onChange={(e) => changeRole(u, e.target.value)} title={self ? 'You cannot change your own role' : undefined}>
                        <option value="student">Student</option><option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-3 py-3"><Badge tone={u.is_active ? 'green' : 'red'}>{u.is_active ? 'Active' : 'Deactivated'}</Badge></td>
                    <td className="px-3 py-3 text-slate-600 dark:text-slate-300">{formatDate(u.created_at)}</td>
                    <td className="px-5 py-3"><div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" icon={u.is_active ? UserX : UserCheck} disabled={self || busyId === u.id} onClick={() => toggleActive(u)} aria-label={`${u.is_active ? 'Deactivate' : 'Reactivate'} ${u.full_name}`} title={self ? 'You cannot deactivate yourself' : u.is_active ? 'Deactivate' : 'Reactivate'} />
                      <Button size="sm" variant="danger-ghost" icon={Trash2} disabled={self || busyId === u.id} onClick={() => remove(u)} aria-label={`Delete ${u.full_name}`} title={self ? 'You cannot delete yourself' : 'Delete'} />
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm dark:border-navy-800">
          <span className="text-slate-500">{data.total} users</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="text-slate-500" aria-live="polite">Page {page} of {pages}</span>
            <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </section>
  );
}
