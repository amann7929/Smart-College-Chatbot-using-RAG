import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import AuthLayout from '../components/layout/AuthLayout';
import { TextInput } from '../components/ui/Form';
import { PasswordInput } from '../components/ui/PasswordInput';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../api';
import { validateEmail } from '../lib/validation';
import { useDocumentTitle } from '../lib/useDocumentTitle';

export default function LoginPage() {
  useDocumentTitle('Sign in');
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: '' })); };

  const submit = async (e) => {
    e.preventDefault();
    const next = { email: validateEmail(form.email), password: form.password ? '' : 'Password is required.' };
    setErrors(next);
    setServerError('');
    if (next.email || next.password) return;
    setBusy(true);
    try {
      await login(form.email.trim(), form.password);
      navigate(location.state?.from || '/chat', { replace: true });
    } catch (err) {
      setServerError(errorMessage(err, 'Could not sign in.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to ask questions and manage your chats."
      footer={<>New to ClgBot? <Link to="/register" className="font-semibold text-brand-600 hover:underline dark:text-brand-300">Create an account</Link></>}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {serverError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{serverError}</div>}
        <TextInput label="Email" type="email" autoComplete="email" icon={Mail} placeholder="you@example.com" value={form.email} onChange={set('email')} error={errors.email} />
        <PasswordInput autoComplete="current-password" placeholder="Your password" value={form.password} onChange={set('password')} error={errors.password} />
        <Button type="submit" size="lg" loading={busy} className="w-full">Sign in</Button>
      </form>
    </AuthLayout>
  );
}
