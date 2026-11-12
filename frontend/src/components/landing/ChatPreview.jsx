import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bot, FileText, Info } from 'lucide-react';
import Markdown from '../chat/Markdown';

// Sample conversations written from the fictional demo documents. This preview is scripted - it does not call the AI.
const SAMPLES = [
  { q: 'What time does the girls hostel gate close?',
    a: 'The girls hostel gate closes at **9:30 pm on weekdays** and 10:00 pm on weekends. Late entry needs prior written permission from the Warden. [S1]',
    src: { file: 'SAMPLE_Hostel_Facilities.pdf', page: 'p. 1' } },
  { q: 'What is the tuition fee for CSE?',
    a: 'Tuition for CSE, CSE-AI and ECE is **Rs. 95,000 per year**. The first instalment (60%) is due by 15 July 2026 and the second by 15 January 2027. [S1]',
    src: { file: 'SAMPLE_Fee_Structure.pdf', page: 'p. 1' } },
  { q: 'How many books can I borrow?',
    a: 'Undergraduate students can borrow **4 books for 14 days**. A late return fine of Rs. 5 per day per book applies. [S1]',
    src: { file: 'SAMPLE_Library_Information.pdf', page: 'p. 1' } },
  { q: 'What is on the canteen menu today?',
    a: 'The uploaded documents do not contain sufficient information to answer this question. Try rephrasing your question, or contact the college office for details.',
    src: null },
];

export default function ChatPreview() {
  const [active, setActive] = useState(0);
  const [phase, setPhase] = useState('answered'); // 'typing' | 'answered'
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const pick = (i) => {
    clearTimeout(timer.current);
    setActive(i); setPhase('typing');
    timer.current = setTimeout(() => setPhase('answered'), 900);
  };
  const s = SAMPLES[active];

  return (
    <div className="card overflow-hidden shadow-pop" aria-label="Interactive chat preview">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-navy-800 dark:bg-navy-950/60">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" aria-hidden /><span className="h-2.5 w-2.5 rounded-full bg-amber-400" aria-hidden /><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden />
        <span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">ClgBot preview</span>
      </div>
      <div className="flex items-start gap-2 bg-amber-50 px-4 py-2 text-[11px] text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
        Interactive preview with sample answers from the fictional demo documents (no live AI). Sign in to ask the real chatbot.
      </div>
      <div className="min-h-[260px] space-y-4 p-4">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Sample questions">
          {SAMPLES.map((x, i) => (
            <button key={x.q} type="button" onClick={() => pick(i)} aria-pressed={active === i}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${active === i ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-200' : 'border-slate-200 text-slate-600 hover:border-brand-300 dark:border-navy-700 dark:text-slate-300'}`}>
              {x.q}
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-brand-600 to-violet-600 px-4 py-2.5 text-sm text-white">{s.q}</div>
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={`${active}-${phase}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-start gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-violet-600 text-white"><Bot className="h-4 w-4" aria-hidden /></div>
            {phase === 'typing' ? (
              <div className="card flex items-center gap-1 px-4 py-3" role="status" aria-label="Preparing sample answer">
                {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-dot-bounce rounded-full bg-brand-500" style={{ animationDelay: `${i * 0.16}s` }} />)}
              </div>
            ) : (
              <div className="min-w-0 flex-1">
                <div className="card px-4 py-3"><Markdown>{s.a}</Markdown></div>
                {s.src && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-navy-800 dark:text-slate-300">
                    <FileText className="h-3.5 w-3.5" aria-hidden />{s.src.file} · {s.src.page}
                  </p>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
