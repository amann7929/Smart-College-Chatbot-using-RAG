import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, FileText, Loader2, RefreshCw, Search, Trash2, Upload } from 'lucide-react';
import { docsApi, errorMessage } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import UploadDialog from '../components/kb/UploadDialog';
import { Badge, EmptyState, ErrorState, Skeleton } from '../components/ui/Feedback';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Form';
import { DOC_STATUS } from '../lib/constants';
import { formatBytes, formatDate } from '../lib/format';
import { useDocumentTitle } from '../lib/useDocumentTitle';

const PAGE_SIZE = 10;
const GRID = 'md:grid md:grid-cols-[minmax(0,2.6fr)_1.5fr_1.1fr_1.2fr_.8fr_6.5rem] md:items-center md:gap-4';

function StatusBadge({ status }) {
  const s = DOC_STATUS[status] || { label: status, tone: 'slate' };
  return (
    <Badge tone={s.tone}>
      {(status === 'processing' || status === 'pending') && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
      {s.label}
    </Badge>
  );
}

export default function KnowledgeBasePage() {
  useDocumentTitle('Knowledge Base');
  const { isAdmin } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [categories, setCategories] = useState([]);
  const [docs, setDocs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const params = useRef({});
  params.current = { page, page_size: PAGE_SIZE, search: search || undefined, category: category || undefined, status: status || undefined };

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await docsApi.list(params.current);
      setDocs(res.items); setTotal(res.total); setError('');
    } catch (e) {
      if (!silent) setError(errorMessage(e, 'Could not load documents.'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { docsApi.categories().then(setCategories).catch(() => {}); }, []);
  useEffect(() => { const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [searchInput]);
  useEffect(() => { load(); }, [load, page, search, category, status]);

  // Poll while anything is still being indexed
  const inProgress = docs.some((d) => d.status === 'pending' || d.status === 'processing');
  useEffect(() => {
    if (!inProgress) return undefined;
    const t = setTimeout(() => load(true), 2500);
    return () => clearTimeout(t);
  }, [inProgress, docs, load]);

  const retry = async (doc) => {
    setBusyId(doc.id);
    try { await docsApi.retry(doc.id); toast.info('Indexing restarted.'); await load(true); }
    catch (e) { toast.error(errorMessage(e, 'Could not retry indexing.')); }
    finally { setBusyId(null); }
  };

  const remove = async (doc) => {
    const ok = await confirm({
      title: 'Delete this document?',
      message: `"${doc.original_filename}" will be removed together with its ${doc.chunk_count} search chunk(s). The chatbot will stop using it immediately.`,
      confirmText: 'Delete document', danger: true,
    });
    if (!ok) return;
    setBusyId(doc.id);
    try { await docsApi.remove(doc.id); toast.success('Document deleted.'); await load(); }
    catch (e) { toast.error(errorMessage(e, 'Could not delete the document.')); }
    finally { setBusyId(null); }
  };

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = !!(search || category || status);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 dark:text-white">Knowledge Base</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Documents the chatbot uses to answer questions. {isAdmin ? 'Upload official PDFs here.' : 'Only administrators can add or remove documents.'}</p>
        </div>
        {isAdmin && <Button icon={Upload} onClick={() => setUploadOpen(true)}>Upload document</Button>}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_14rem_10rem]">
        <div className="relative">
          <label htmlFor="doc-search" className="sr-only">Search documents</label>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input id="doc-search" type="search" className="input pl-10" placeholder="Search by file name" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </div>
        <Select aria-label="Filter by category" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
          <option value="">All categories</option>{categories.map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Select aria-label="Filter by status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>{Object.entries(DOC_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </Select>
      </div>

      <div className="card mt-5 overflow-hidden">
        <div className={`hidden border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:border-navy-800 dark:bg-navy-950/50 dark:text-slate-400 ${GRID}`} aria-hidden>
          <span>Document</span><span>Category</span><span>Uploaded</span><span>Status</span><span>Chunks</span><span className="text-right">{isAdmin ? 'Actions' : ''}</span>
        </div>
        {loading && <div className="space-y-3 p-5" aria-label="Loading documents">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>}
        {!loading && error && <ErrorState message={error} onRetry={() => load()} />}
        {!loading && !error && docs.length === 0 && (
          <EmptyState icon={BookOpen} title={filtered ? 'No documents match your filters' : 'No documents yet'}
            description={filtered ? 'Try a different search or clear the filters.' : isAdmin ? 'Upload your first PDF to start building the knowledge base.' : 'An administrator has not uploaded any documents yet.'}
            action={!filtered && isAdmin ? <Button icon={Upload} onClick={() => setUploadOpen(true)}>Upload document</Button> : null} />
        )}
        {!loading && !error && docs.length > 0 && (
          <ul className="divide-y divide-slate-100 dark:divide-navy-800">
            {docs.map((d) => (
              <li key={d.id} className="px-5 py-4">
                <div className={`space-y-2 md:space-y-0 ${GRID}`}>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300"><FileText className="h-[18px] w-[18px]" aria-hidden /></span>
                    <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900 dark:text-white" title={d.original_filename}>{d.original_filename}</p>
                      <p className="text-xs text-slate-400">{formatBytes(d.file_size)}{d.page_count ? ` · ${d.page_count} page${d.page_count > 1 ? 's' : ''}` : ''}</p></div>
                  </div>
                  <div><Badge tone="violet">{d.category}</Badge></div>
                  <div className="text-sm text-slate-600 dark:text-slate-300"><span className="md:hidden text-xs text-slate-400">Uploaded </span>{formatDate(d.created_at)}</div>
                  <div><StatusBadge status={d.status} /></div>
                  <div className="text-sm text-slate-600 dark:text-slate-300"><span className="md:hidden text-xs text-slate-400">Chunks </span>{d.status === 'indexed' ? d.chunk_count : '-'}</div>
                  <div className="flex justify-end gap-1">
                    {isAdmin && d.status === 'failed' && <Button size="sm" variant="secondary" icon={RefreshCw} loading={busyId === d.id} onClick={() => retry(d)} aria-label={`Retry indexing ${d.original_filename}`}>Retry</Button>}
                    {isAdmin && <Button size="sm" variant="danger-ghost" icon={Trash2} disabled={busyId === d.id || d.status === 'pending' || d.status === 'processing'} onClick={() => remove(d)} aria-label={`Delete ${d.original_filename}`} title={d.status === 'processing' || d.status === 'pending' ? 'Wait until processing finishes' : 'Delete'} />}
                  </div>
                </div>
                {d.status === 'failed' && d.error_message && (
                  <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-300"><strong>Indexing error:</strong> {d.error_message}</p>
                )}
              </li>
            ))}
          </ul>
        )}
        {!loading && !error && total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm dark:border-navy-800">
            <span className="text-slate-500">{total} documents</span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="text-slate-500" aria-live="polite">Page {page} of {pages}</span>
              <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </div>

      {isAdmin && <UploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} categories={categories}
        onUploaded={() => { toast.success('Uploaded. Indexing has started.'); setPage(1); load(); }} />}
    </div>
  );
}
