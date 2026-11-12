import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight, Award, BarChart3, BookOpen, Briefcase, Bus, CalendarDays, Cpu, Database, FileText, GraduationCap, Layers,
  Library, Lock, Menu, MessageSquare, Moon, Phone, Scale, ScrollText, Scissors, Search, ShieldCheck, Sparkles, Sun, Upload,
  Building2, Users, Wallet, X, Zap,
} from 'lucide-react';
import { Logo } from '../components/ui/Feedback';
import { Button, IconButton } from '../components/ui/Button';
import ChatPreview from '../components/landing/ChatPreview';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useDocumentTitle } from '../lib/useDocumentTitle';

const FEATURES = [
  { icon: ShieldCheck, title: 'Grounded answers only', text: 'Replies are built from retrieved passages of your documents. If the answer is not there, the bot says so instead of guessing.' },
  { icon: FileText, title: 'Real source citations', text: 'Each answer lists the document, page and passage it used, taken straight from the retrieval step.' },
  { icon: Database, title: 'Local vector search', text: 'Sentence Transformers embeddings stored in a persistent ChromaDB. Only the relevant chunks are sent to the language model.' },
  { icon: Upload, title: 'Simple document management', text: 'Admins upload PDFs, track indexing status, retry failures and remove outdated files together with their vectors.' },
  { icon: BarChart3, title: 'Admin analytics', text: 'Usage charts, document status, recent activity, user management and student feedback in one dashboard.' },
  { icon: Lock, title: 'Secure by design', text: 'Argon2 password hashing, JWT sessions with revocation, role-based access, rate limiting and audit logs.' },
];

const STEPS = [
  { icon: Upload, label: 'Upload PDF' }, { icon: FileText, label: 'Extract text' }, { icon: Scissors, label: 'Split into chunks' },
  { icon: Cpu, label: 'Create embeddings' }, { icon: Database, label: 'Store in ChromaDB' }, { icon: Search, label: 'Retrieve top-k' },
  { icon: Sparkles, label: 'Generate with Groq' }, { icon: Layers, label: 'Answer + sources' },
];

const CATEGORIES = [
  [Building2, 'College Profile'], [GraduationCap, 'Courses and Departments'], [ScrollText, 'Admission Process'], [Wallet, 'Fee Structure'],
  [Users, 'Faculty Information'], [BookOpen, 'Syllabus'], [FileText, 'Examination Rules'], [CalendarDays, 'Academic Calendar'],
  [Building2, 'Hostel Facilities'], [Library, 'Library Information'], [Bus, 'Transport Facilities'], [Briefcase, 'Placement Information'],
  [Award, 'Scholarships'], [Scale, 'Rules and Regulations'], [Phone, 'Contact Information'],
];

const HOW = [
  { n: '1', title: 'Admin adds official documents', text: 'Upload the fee structure, syllabus, calendar and other PDFs and pick a category for each.' },
  { n: '2', title: 'Documents are indexed', text: 'Text is extracted, split into overlapping chunks, embedded and stored. Status updates live until it is ready.' },
  { n: '3', title: 'Students ask in plain language', text: 'The best matching passages are retrieved and the model writes a short answer with citations you can verify.' },
];

const fade = { initial: { opacity: 0, y: 18 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-60px' }, transition: { duration: 0.45 } };

export default function LandingPage() {
  useDocumentTitle('');
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const [menu, setMenu] = useState(false);
  const links = [['Features', '#features'], ['How it works', '#how'], ['Topics', '#topics']];

  return (
    <div className="bg-white dark:bg-navy-950">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur dark:border-navy-800 dark:bg-navy-950/85">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link to="/" aria-label="ClgBot home"><Logo /></Link>
          <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
            {links.map(([l, h]) => <a key={h} href={h} className="text-sm font-medium text-slate-600 hover:text-brand-600 dark:text-slate-300 dark:hover:text-white">{l}</a>)}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <IconButton label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} icon={theme === 'dark' ? Sun : Moon} onClick={toggle} />
            {user ? <Link to="/chat"><Button>Open chat</Button></Link> : (
              <><Link to="/login"><Button variant="ghost">Log in</Button></Link><Link to="/register"><Button>Get started</Button></Link></>
            )}
          </div>
          <IconButton label={menu ? 'Close menu' : 'Open menu'} icon={menu ? X : Menu} className="md:hidden" onClick={() => setMenu((m) => !m)} />
        </div>
        {menu && (
          <div className="space-y-1 border-t border-slate-200 px-5 py-3 dark:border-navy-800 md:hidden">
            {links.map(([l, h]) => <a key={h} href={h} onClick={() => setMenu(false)} className="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-navy-800">{l}</a>)}
            <div className="flex gap-2 pt-2">
              {user ? <Link to="/chat" className="flex-1"><Button className="w-full">Open chat</Button></Link> : (
                <><Link to="/login" className="flex-1"><Button variant="secondary" className="w-full">Log in</Button></Link><Link to="/register" className="flex-1"><Button className="w-full">Get started</Button></Link></>
              )}
              <IconButton label="Toggle theme" icon={theme === 'dark' ? Sun : Moon} onClick={toggle} className="border border-slate-200 dark:border-navy-700" />
            </div>
          </div>
        )}
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-gradient-to-b from-brand-50 via-white to-transparent dark:from-navy-900 dark:via-navy-950" aria-hidden />
          <div className="pointer-events-none absolute -right-32 top-10 h-96 w-96 rounded-full bg-violet-300/30 blur-3xl dark:bg-violet-600/10" aria-hidden />
          <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-14 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
            <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-brand-700 dark:border-navy-700 dark:bg-navy-900 dark:text-brand-200">
                <Zap className="h-3.5 w-3.5" aria-hidden /> Retrieval-Augmented Generation
              </span>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-navy-900 dark:text-white sm:text-5xl">
                A college chatbot that answers from <span className="gradient-text">your own documents</span>
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
                Ask about admissions, fees, hostel, exams or placements. ClgBot finds the right passage in the official PDFs, answers in plain language and shows exactly where the answer came from.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to={user ? '/chat' : '/register'}><Button size="lg">{user ? 'Open chat' : 'Get started free'}<ArrowRight className="h-4 w-4" aria-hidden /></Button></Link>
                {!user && <Link to="/login"><Button size="lg" variant="secondary">Log in</Button></Link>}
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.1 }}><ChatPreview /></motion.div>
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
          <motion.div {...fade} className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-navy-900 dark:text-white">Built to be trusted</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">A chatbot for a college must never invent a fee or a date. These choices keep answers honest.</p>
          </motion.div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }, i) => (
              <motion.div key={title} {...fade} transition={{ duration: 0.4, delay: i * 0.05 }} className="card p-6 transition hover:-translate-y-0.5 hover:shadow-pop">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-violet-50 text-brand-600 dark:from-navy-800 dark:to-navy-800 dark:text-brand-300"><Icon className="h-5 w-5" aria-hidden /></div>
                <h3 className="mt-4 font-semibold text-slate-900 dark:text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{text}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="bg-slate-50 py-20 dark:bg-navy-900/50" aria-labelledby="workflow">
          <div className="mx-auto max-w-6xl px-5">
            <motion.div {...fade} className="mx-auto max-w-2xl text-center">
              <h2 id="workflow" className="text-3xl font-bold tracking-tight text-navy-900 dark:text-white">The RAG workflow</h2>
              <p className="mt-3 text-slate-600 dark:text-slate-300">From a PDF upload to a cited answer, every step is real and inspectable.</p>
            </motion.div>
            <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map(({ icon: Icon, label }, i) => (
                <motion.li key={label} {...fade} transition={{ duration: 0.35, delay: i * 0.04 }} className="card flex items-center gap-3 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-violet-600 text-white"><Icon className="h-5 w-5" aria-hidden /></span>
                  <span><span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">Step {i + 1}</span><span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</span></span>
                </motion.li>
              ))}
            </ol>
          </div>
        </section>

        <section id="topics" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
          <motion.div {...fade} className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-navy-900 dark:text-white">What you can ask about</h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300">Documents are organised into categories so the knowledge base stays tidy.</p>
          </motion.div>
          <ul className="mt-10 flex flex-wrap justify-center gap-3">
            {CATEGORIES.map(([Icon, label]) => (
              <li key={label} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm dark:border-navy-700 dark:bg-navy-900 dark:text-slate-200">
                <Icon className="h-4 w-4 text-violet-500" aria-hidden />{label}
              </li>
            ))}
          </ul>
        </section>

        <section id="how" className="scroll-mt-20 bg-gradient-to-br from-navy-900 via-navy-800 to-violet-900 py-20 text-white">
          <div className="mx-auto max-w-6xl px-5">
            <motion.h2 {...fade} className="text-center text-3xl font-bold tracking-tight">How it works</motion.h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {HOW.map((h, i) => (
                <motion.div key={h.n} {...fade} transition={{ duration: 0.4, delay: i * 0.08 }} className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-sm font-bold">{h.n}</span>
                  <h3 className="mt-4 text-lg font-semibold">{h.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">{h.text}</p>
                </motion.div>
              ))}
            </div>
            <div className="mt-12 text-center">
              <Link to={user ? '/chat' : '/register'}><Button size="lg" variant="secondary" className="!border-0">{user ? 'Open chat' : 'Create your account'}<MessageSquare className="h-4 w-4" aria-hidden /></Button></Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-8 dark:border-navy-800">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 text-sm text-slate-500 dark:text-slate-400 sm:flex-row">
          <Logo />
          <p>B.Tech CSE-AI SSP project. Demonstration documents are fictional sample data.</p>
        </div>
      </footer>
    </div>
  );
}
