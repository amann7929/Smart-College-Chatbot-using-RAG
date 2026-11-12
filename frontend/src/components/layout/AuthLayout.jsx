import { Link } from 'react-router-dom';
import { CheckCircle2, Moon, ShieldCheck, Sparkles, Sun } from 'lucide-react';
import { Logo } from '../ui/Feedback';
import { IconButton } from '../ui/Button';
import { useTheme } from '../../context/ThemeContext';

const POINTS = [
  'Answers come only from your official college documents',
  'Every answer shows the document and page it used',
  'Say "I don\'t know" instead of guessing fees or dates',
];

export default function AuthLayout({ title, subtitle, children, footer }) {
  const { theme, toggle } = useTheme();
  return (
    <div className="grid min-h-screen bg-[#f6f7fb] dark:bg-navy-950 lg:grid-cols-[1.04fr_0.96fr]">
      <aside className="relative hidden overflow-hidden bg-[#11152e] p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_15%,rgba(90,91,255,0.34),transparent_42%),radial-gradient(ellipse_at_90%_85%,rgba(138,55,238,0.3),transparent_38%)]" aria-hidden />
        <div className="pointer-events-none absolute -right-24 top-1/3 h-80 w-80 rounded-full border border-white/10" aria-hidden />
        <div className="pointer-events-none absolute -right-12 top-[38%] h-56 w-56 rounded-full border border-white/10" aria-hidden />
        <Link to="/" className="relative z-10 inline-flex items-center gap-3 text-xl font-bold"><img src="/favicon.svg" alt="" className="h-10 w-10 rounded-xl shadow-lg shadow-brand-500/20" />ClgBot</Link>
        <div className="relative z-10 max-w-lg py-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3.5 py-1.5 text-xs font-semibold tracking-wide text-violet-100">
            <Sparkles className="h-3.5 w-3.5" aria-hidden /> YOUR COLLEGE, CLEARLY ANSWERED
          </span>
          <h2 className="mt-7 text-4xl font-bold leading-[1.12] tracking-tight xl:text-5xl">Your college questions, <span className="bg-gradient-to-r from-indigo-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">answered from the source.</span></h2>
          <p className="mt-5 max-w-md text-base leading-7 text-slate-300">A smarter, simpler way to find the information you need in official college documents.</p>
          <ul className="mt-8 space-y-4">
            {POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm text-slate-200"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-violet-300" aria-hidden />{p}</li>
            ))}
          </ul>
        </div>
      </aside>
      <main className="relative flex items-center justify-center overflow-hidden px-5 py-12 sm:px-8">
        <div className="pointer-events-none absolute -right-32 -top-28 h-96 w-96 rounded-full bg-violet-200/40 blur-3xl dark:bg-brand-600/10" aria-hidden />
        <div className="absolute right-4 top-4 z-10"><IconButton label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} icon={theme === 'dark' ? Sun : Moon} onClick={toggle} /></div>
        <div className="relative w-full max-w-[430px]">
          <Link to="/" className="mb-7 inline-block lg:hidden" aria-label="ClgBot home"><Logo /></Link>
          <div className="rounded-[28px] border border-white/80 bg-white/90 p-7 shadow-[0_24px_80px_-28px_rgba(31,41,90,0.28)] backdrop-blur-xl dark:border-navy-800 dark:bg-navy-900/90 sm:p-9">
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-violet-600 text-white shadow-lg shadow-brand-600/25"><ShieldCheck className="h-6 w-6" aria-hidden /></div>
            <h1 className="text-2xl font-bold tracking-tight text-navy-900 dark:text-white">{title}</h1>
            <p className="mb-7 mt-1.5 text-sm leading-6 text-slate-500 dark:text-slate-400">{subtitle}</p>
            {children}
          </div>
          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">{footer}</p>
          <p className="mt-6 text-center text-[11px] text-slate-400 dark:text-slate-500">Your information is protected with secure sign-in.</p>
        </div>
      </main>
    </div>
  );
}
