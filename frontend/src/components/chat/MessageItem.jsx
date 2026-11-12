import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Bot, Check, Copy, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react';
import Markdown from './Markdown';
import SourceList from './SourceList';
import { Button, IconButton } from '../ui/Button';
import { copyText } from '../../lib/clipboard';
import { formatDateTime, formatTime } from '../../lib/format';

function Time({ iso }) {
  return <time dateTime={iso} title={formatDateTime(iso)} className="text-[11px] text-slate-400">{formatTime(iso)}</time>;
}

export function TypingIndicator() {
  return (
    <div className="flex items-start gap-3" role="status" aria-label="The assistant is preparing an answer">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-violet-600 text-white"><Bot className="h-4 w-4" aria-hidden /></div>
      <div className="card flex items-center gap-3 px-4 py-3">
        <span className="flex gap-1" aria-hidden>
          {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-dot-bounce rounded-full bg-brand-500" style={{ animationDelay: `${i * 0.16}s` }} />)}
        </span>
        <span className="text-sm text-slate-500 dark:text-slate-400">Searching the documents and writing an answer...</span>
      </div>
    </div>
  );
}

export default function MessageItem({ message, prefs, onRetry, retrying, onFeedback, onResend, sendingLocked }) {
  const [copied, setCopied] = useState(false);
  const compact = prefs.compact_mode;

  if (message.role === 'user') {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-end">
        <div className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-gradient-to-br from-brand-600 to-violet-600 text-sm text-white shadow-sm ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
          {message.content}
        </div>
        <div className="mt-1 flex items-center gap-2 pr-1">
          {message.sendError ? (
            <>
              <span role="alert" className="text-xs text-red-600 dark:text-red-400">Not sent: {message.sendError}</span>
              <Button size="sm" variant="secondary" icon={RefreshCw} disabled={sendingLocked} onClick={() => onResend(message)}>Retry send</Button>
            </>
          ) : <Time iso={message.created_at} />}
        </div>
      </motion.div>
    );
  }

  const failed = message.status === 'failed';

  const onCopy = async () => {
    if (await copyText(message.content)) { setCopied(true); setTimeout(() => setCopied(false), 1800); }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${failed ? 'bg-red-500' : 'bg-gradient-to-br from-brand-600 to-violet-600'}`}>
        {failed ? <AlertTriangle className="h-4 w-4" aria-hidden /> : <Bot className="h-4 w-4" aria-hidden />}
      </div>
      <div className="min-w-0 max-w-[92%] flex-1">
        <div className={`card ${compact ? 'px-3.5 py-2.5' : 'px-4 py-3.5'} ${failed ? 'border-red-200 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20' : ''}`}>
          {failed ? (
            <div role="alert">
              <p className="text-sm font-medium text-red-700 dark:text-red-300">{message.content}</p>
              <p className="mt-1 text-xs text-red-600/80 dark:text-red-300/70">Your question was saved. You can retry without typing it again.</p>
              <Button className="mt-3" size="sm" variant="secondary" icon={RefreshCw} loading={retrying} onClick={() => onRetry(message)}>Retry answer</Button>
            </div>
          ) : (
            <Markdown>{message.content}</Markdown>
          )}
          {!failed && prefs.show_sources && <SourceList sources={message.sources} />}
        </div>
        <div className="mt-1 flex items-center gap-1 pl-1">
          <Time iso={message.created_at} />
          {!failed && (
            <>
              <IconButton label={copied ? 'Copied' : 'Copy answer'} icon={copied ? Check : Copy} className="h-7 w-7" onClick={onCopy} />
              <IconButton label="Helpful answer" icon={ThumbsUp} aria-pressed={message.my_feedback === 1}
                className={`h-7 w-7 ${message.my_feedback === 1 ? '!text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' : ''}`} onClick={() => onFeedback(message, 1)} />
              <IconButton label="Not helpful" icon={ThumbsDown} aria-pressed={message.my_feedback === -1}
                className={`h-7 w-7 ${message.my_feedback === -1 ? '!text-red-600 bg-red-50 dark:bg-red-900/30' : ''}`} onClick={() => onFeedback(message, -1)} />
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
