import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { useDocumentTitle } from '../lib/useDocumentTitle';

export default function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="gradient-text text-6xl font-extrabold">404</p>
      <h1 className="mt-3 text-xl font-semibold text-navy-900 dark:text-white">This page does not exist</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">The link may be broken or the page may have moved.</p>
      <Link to="/" className="mt-6"><Button>Back to home</Button></Link>
    </div>
  );
}
