import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, BookOpen, FileStack, MessageCircleQuestion, RefreshCw, ThumbsUp, Users } from 'lucide-react';
import { adminApi } from '../api';
import { useTheme } from '../context/ThemeContext';
import UsersTable from '../components/admin/UsersTable';
import { EmptyState, ErrorState, Skeleton } from '../components/ui/Feedback';
import { Button } from '../components/ui/Button';
import { actionLabel, timeAgo } from '../lib/format';
import { useFetch } from '../lib/useFetch';
import { useDocumentTitle } from '../lib/useDocumentTitle';

function StatCard({ icon: Icon, label, value, sub, loading, tone }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${tone}`}><Icon className="h-[18px] w-[18px]" aria-hidden /></span>
      </div>
      {loading ? <Skeleton className="mt-3 h-8 w-20" /> : <p className="mt-2 text-3xl font-bold tracking-tight text-navy-900 dark:text-white">{value?.toLocaleString() ?? '-'}</p>}
      <p className="mt-1 text-xs text-slate-400">{loading ? '\u00a0' : sub}</p>
    </div>
  );
}

const STATUS_ROWS = [
  ['indexed', 'Indexed', 'bg-emerald-500'], ['processing', 'Processing', 'bg-brand-500'],
  ['pending', 'Queued', 'bg-slate-400'], ['failed', 'Failed', 'bg-red-500'],
];

export default function AdminPage() {
  useDocumentTitle('Admin Dashboard');
  const { theme } = useTheme();
  const [days, setDays] = useState(14);
  const stats = useFetch(() => adminApi.stats(), []);
  const usage = useFetch(() => adminApi.usage(days), [days]);
  const feedback = useFetch(() => adminApi.feedback(), []);
  const activity = useFetch(() => adminApi.activity(12), []);

  const s = stats.data;
  const axis = theme === 'dark' ? '#8a9ccf' : '#64748b';
  const grid = theme === 'dark' ? '#233163' : '#e2e8f0';
  const chartData = (usage.data || []).map((d) => ({ ...d, label: new Date(`${d.day}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }));
  const noUsage = usage.data && usage.data.every((d) => d.questions === 0 && d.new_users === 0);
  const refreshAll = () => { stats.reload(); usage.reload(); feedback.reload(); activity.reload(); };
  const docTotal = s ? s.total_documents : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 dark:text-white">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Usage, documents and users at a glance.</p>
        </div>
        <Button variant="secondary" icon={RefreshCw} onClick={refreshAll}>Refresh</Button>
      </div>

      {stats.error ? <div className="card"><ErrorState message={stats.error} onRetry={() => stats.reload()} /></div> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Users} label="Registered users" value={s?.total_users} sub={s && `${s.active_users} active`} loading={stats.loading} tone="bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-200" />
          <StatCard icon={BookOpen} label="Documents" value={s?.total_documents} sub={s && `${s.indexed_documents} indexed`} loading={stats.loading} tone="bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-200" />
          <StatCard icon={FileStack} label="Indexed chunks" value={s?.total_chunks} sub="searchable passages" loading={stats.loading} tone="bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300" />
          <StatCard icon={MessageCircleQuestion} label="Questions asked" value={s?.total_questions} sub={s && `${s.total_chats} chats`} loading={stats.loading} tone="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-200" />
        </div>
      )}

      <section className="card p-5" aria-labelledby="usage-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="usage-title" className="text-base font-semibold text-slate-900 dark:text-white">Daily usage</h2>
          <select aria-label="Usage period" className="input h-9 w-auto py-0 text-xs" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option><option value={14}>Last 14 days</option><option value={30}>Last 30 days</option>
          </select>
        </div>
        {usage.error ? <ErrorState message={usage.error} onRetry={() => usage.reload()} /> : usage.loading ? <Skeleton className="mt-4 h-64" /> : (
          <>
            {noUsage && <p className="mt-2 text-xs text-slate-400">No questions or sign-ups in this period yet.</p>}
            <div className="mt-4 h-64" role="img" aria-label={`Area chart of questions asked and new users per day for the last ${days} days`}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gq" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b6cf6" stopOpacity={0.35} /><stop offset="95%" stopColor="#3b6cf6" stopOpacity={0} /></linearGradient>
                    <linearGradient id="gu" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} /><stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: axis, fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis allowDecimals={false} tick={{ fill: axis, fontSize: 11 }} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid ' + grid, background: theme === 'dark' ? '#0f172a' : '#fff', fontSize: 12 }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="questions" name="Questions" stroke="#3b6cf6" strokeWidth={2} fill="url(#gq)" />
                  <Area type="monotone" dataKey="new_users" name="New users" stroke="#8b5cf6" strokeWidth={2} fill="url(#gu)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5" aria-labelledby="docs-title">
          <div className="flex items-center justify-between">
            <h2 id="docs-title" className="text-base font-semibold text-slate-900 dark:text-white">Document processing</h2>
            <Link to="/knowledge-base" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-300">Manage</Link>
          </div>
          {stats.loading ? <Skeleton className="mt-4 h-32" /> : docTotal === 0 ? (
            <EmptyState icon={BookOpen} title="No documents yet" description="Upload PDFs in the Knowledge Base." />
          ) : (
            <>
              <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-navy-800" role="img" aria-label="Documents by processing status">
                {STATUS_ROWS.map(([k, , color]) => { const n = s[k === 'pending' ? 'pending_documents' : k === 'processing' ? 'processing_documents' : `${k}_documents`]; return n ? <div key={k} className={color} style={{ width: `${(n / docTotal) * 100}%` }} /> : null; })}
              </div>
              <ul className="mt-4 space-y-2.5">
                {STATUS_ROWS.map(([k, label, color]) => {
                  const n = s[k === 'pending' ? 'pending_documents' : k === 'processing' ? 'processing_documents' : `${k}_documents`];
                  return <li key={k} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 text-slate-600 dark:text-slate-300"><span className={`h-2.5 w-2.5 rounded-full ${color}`} aria-hidden />{label}</span><span className="font-semibold text-slate-900 dark:text-white">{n}</span></li>;
                })}
              </ul>
            </>
          )}
        </section>

        <section className="card p-5" aria-labelledby="fb-title">
          <h2 id="fb-title" className="text-base font-semibold text-slate-900 dark:text-white">Student feedback</h2>
          {feedback.error ? <ErrorState message={feedback.error} onRetry={() => feedback.reload()} /> : feedback.loading ? <Skeleton className="mt-4 h-40" /> : feedback.data.total === 0 ? (
            <EmptyState icon={ThumbsUp} title="No feedback yet" description="Thumbs up/down ratings from students will appear here." />
          ) : (
            <div className="mt-2 flex items-center gap-4">
              <div className="h-40 w-40 shrink-0" role="img" aria-label={`${feedback.data.positive} helpful and ${feedback.data.negative} not helpful ratings`}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={[{ name: 'Helpful', value: feedback.data.positive }, { name: 'Not helpful', value: feedback.data.negative }]} dataKey="value" innerRadius={42} outerRadius={64} paddingAngle={3} stroke="none">
                    <Cell fill="#10b981" /><Cell fill="#ef4444" /></Pie><Tooltip /></PieChart>
                </ResponsiveContainer>
              </div>
              <div>
                <p className="text-3xl font-bold text-navy-900 dark:text-white">{Math.round(feedback.data.positive_rate * 100)}%</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">rated helpful</p>
                <p className="mt-2 text-xs text-slate-400">{feedback.data.positive} up, {feedback.data.negative} down, {feedback.data.total} total</p>
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="card overflow-hidden" aria-labelledby="act-title">
        <div className="flex items-center gap-2 border-b border-slate-200 p-5 dark:border-navy-800"><Activity className="h-4 w-4 text-brand-500" aria-hidden /><h2 id="act-title" className="text-base font-semibold text-slate-900 dark:text-white">Recent activity</h2></div>
        {activity.error ? <ErrorState message={activity.error} onRetry={() => activity.reload()} /> : activity.loading ? <div className="space-y-2 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-8" />)}</div> : activity.data.length === 0 ? (
          <EmptyState icon={Activity} title="No activity recorded yet" />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-navy-800">
            {activity.data.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span><span className="font-medium text-slate-900 dark:text-white">{actionLabel(a.action)}</span>
                  <span className="text-slate-500 dark:text-slate-400"> {a.user_email ? `by ${a.user_email}` : a.details?.email ? `for ${a.details.email}` : ''}</span></span>
                <time dateTime={a.created_at} className="text-xs text-slate-400">{timeAgo(a.created_at)}</time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <UsersTable onChanged={() => stats.reload(true)} />
    </div>
  );
}
