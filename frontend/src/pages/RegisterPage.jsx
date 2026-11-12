import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, User } from 'lucide-react';
import AuthLayout from '../components/layout/AuthLayout';
import { TextInput } from '../components/ui/Form';
import { PasswordChecklist, PasswordInput } from '../components/ui/PasswordInput';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { errorMessage, fieldErrors } from '../api';
import { passwordChecks, validateEmail, validateName, validatePassword } from '../lib/validation';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import { useToast } from '../context/ToastContext';

export default function RegisterPage() {
  useDocumentTitle('Create account');
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: '' })); };

  const submit = async (e) => {
    e.preventDefault();
    const next = {
      name: validateName(form.name), email: validateEmail(form.email), password: validatePassword(form.password),
      confirm: form.confirm !== form.password ? 'Passwords do not match.' : '',
    };
    setErrors(next);
    setServerError('');
    if (Object.values(next).some(Boolean)) return;
    setBusy(true);
    try {
      await register(form.email.trim(), form.name.trim(), form.password);
      toast.success('Account created. Welcome to ClgBot!');
      navigate('/chat', { replace: true });
    } catch (err) {
      const fe = fieldErrors(err);
      if (Object.keys(fe).length) setErrors({ name: fe.full_name, email: fe.email, password: fe.password });
      setServerError(errorMessage(err, 'Could not create the account.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout title="Create your account" subtitle="Students can start asking questions right away."
      footer={<>Already registered? <Link to="/login" className="font-semibold text-brand-600 hover:underline dark:text-brand-300">Sign in</Link></>}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {serverError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{serverError}</div>}
        <TextInput label="Full name" autoComplete="name" icon={User} placeholder="Your full name" value={form.name} onChange={set('name')} error={errors.name} />
        <TextInput label="Email" type="email" autoComplete="email" icon={Mail} placeholder="you@example.com" value={form.email} onChange={set('email')} error={errors.email} />
        <div>
          <PasswordInput autoComplete="new-password" placeholder="Create a password" value={form.password} onChange={set('password')} error={errors.password} />
          <PasswordChecklist checks={passwordChecks(form.password)} />
        </div>
        <PasswordInput label="Confirm password" autoComplete="new-password" placeholder="Repeat the password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} />
        <Button type="submit" size="lg" loading={busy} className="w-full">Create account</Button>
      </form>
    </AuthLayout>
  );
}
