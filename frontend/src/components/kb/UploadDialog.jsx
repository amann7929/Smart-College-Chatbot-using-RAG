import { useEffect, useRef, useState } from 'react';
import { FileUp, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Select } from '../ui/Form';
import { docsApi, errorMessage } from '../../api';
import { formatBytes } from '../../lib/format';
import { MAX_UPLOAD_MB } from '../../lib/constants';

export default function UploadDialog({ open, onClose, categories, onUploaded }) {
  const [file, setFile] = useState(null);
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(null);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);
  const busy = progress !== null;

  useEffect(() => { if (open) { setFile(null); setCategory(''); setError(''); setProgress(null); } }, [open]);

  const choose = (f) => {
    setError('');
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.pdf')) { setError('Only PDF files are accepted.'); return; }
    if (f.size > MAX_UPLOAD_MB * 1024 * 1024) { setError(`File is too large. The limit is ${MAX_UPLOAD_MB} MB.`); return; }
    if (f.size === 0) { setError('The selected file is empty.'); return; }
    setFile(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return setError('Choose a PDF file first.');
    if (!category) return setError('Select a category.');
    setError(''); setProgress(0);
    try {
      const doc = await docsApi.upload(file, category, setProgress);
      onUploaded(doc);
      onClose();
    } catch (err) {
      setError(errorMessage(err, 'Upload failed.'));
      setProgress(null);
    }
  };

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} title="Upload a document" size="lg"
      description="The PDF is validated, then indexed in the background. You can follow its status in the list.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); choose(e.dataTransfer.files?.[0]); }}
          className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${drag ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-slate-300 dark:border-navy-700'}`}
        >
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="sr-only" id="pdf-file" aria-label="PDF file"
            onChange={(e) => choose(e.target.files?.[0])} disabled={busy} />
          {file ? (
            <div className="flex items-center justify-between gap-3 text-left">
              <div className="min-w-0"><p className="truncate text-sm font-medium text-slate-900 dark:text-white">{file.name}</p><p className="text-xs text-slate-500">{formatBytes(file.size)}</p></div>
              <button type="button" onClick={() => setFile(null)} disabled={busy} aria-label="Remove selected file" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800"><X className="h-4 w-4" aria-hidden /></button>
            </div>
          ) : (
            <>
              <FileUp className="mx-auto h-8 w-8 text-brand-500" aria-hidden />
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Drag a PDF here, or</p>
              <Button variant="secondary" size="sm" className="mt-2" onClick={() => inputRef.current?.click()}>Choose file</Button>
              <p className="mt-2 text-xs text-slate-400">PDF only, up to {MAX_UPLOAD_MB} MB. Scanned (image-only) PDFs are not supported.</p>
            </>
          )}
        </div>
        <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} disabled={busy}>
          <option value="">Select a category...</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        {busy && (
          <div aria-live="polite">
            <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-navy-800"><div className="h-full rounded-full bg-gradient-to-r from-brand-600 to-violet-600 transition-all" style={{ width: `${progress}%` }} /></div>
            <p className="mt-1 text-xs text-slate-500">{progress < 100 ? `Uploading... ${progress}%` : 'Upload complete, starting indexing...'}</p>
          </div>
        )}
        {error && <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={!file || !category}>Upload and index</Button>
        </div>
      </form>
    </Modal>
  );
}
