import { useState } from 'react';
import { ChevronDown, FileText } from 'lucide-react';
import { Badge } from '../ui/Feedback';
import { pageLabel } from '../../lib/format';

/** Shows the passages that were actually retrieved for this answer (data comes from the retrieval step). */
export default function SourceList({ sources }) {
  const [open, setOpen] = useState(false);
  if (!sources?.length) return null;
  const id = `sources-${sources[0].document_id}-${sources.length}-${sources[0].chunk_index}`;

  return (
    <div className="mt-3">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={id}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-navy-800">
        <FileText className="h-3.5 w-3.5" aria-hidden />
        Sources ({sources.length})
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      <ul id={id} hidden={!open} className="mt-2 space-y-2">
        {sources.map((s) => (
          <li key={s.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs dark:border-navy-700 dark:bg-navy-950/60">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="violet">{s.id}</Badge>
              <span className="font-medium text-slate-800 dark:text-slate-100">{s.filename}</span>
              <span className="text-slate-500 dark:text-slate-400">{pageLabel(s)}</span>
              <Badge tone="slate">{s.category}</Badge>
              {s.cited && <Badge tone="green">Cited in answer</Badge>}
              <span className="ml-auto text-slate-400" title="Cosine similarity between your question and this passage (0-1)">
                similarity {Number(s.similarity).toFixed(2)}
              </span>
            </div>
            <p className="mt-2 line-clamp-4 leading-relaxed text-slate-600 dark:text-slate-300">{s.snippet}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
