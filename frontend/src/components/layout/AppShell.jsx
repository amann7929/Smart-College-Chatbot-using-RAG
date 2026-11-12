import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import { IconButton } from '../ui/Button';
import { Logo } from '../ui/Feedback';

export default function AppShell() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow">Skip to content</a>
      <Sidebar open={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 dark:border-navy-800 dark:bg-navy-900 lg:hidden">
          <IconButton label="Open sidebar" icon={Menu} onClick={() => setOpen(true)} />
          <Link to="/" aria-label="ClgBot home"><Logo /></Link>
        </header>
        <main id="main" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto focus:outline-none"><Outlet /></main>
      </div>
    </div>
  );
}
