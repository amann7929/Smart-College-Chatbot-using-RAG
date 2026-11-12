import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, LogOut, Moon, Sun, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../api';
import { Avatar, Badge } from '../components/ui/Feedback';
import { Button } from '../components/ui/Button';
import { TextInput, Toggle } from '../components/ui/Form';
import { PasswordChecklist, PasswordInput } from '../components/ui/PasswordInput';
import { passwordChecks, validateName, validatePassword } from '../lib/validation';
import { formatDate } from '../lib/format';
import { useDocumentTitle } from '../lib/useDocumentTitle';

function Section({ title, description, children }) {
  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  useDocumentTitle('Settings');
  const { user, updateProfile, changePassword, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState(user.full_name);
  const [nameError, setNameError] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwErrors, setPwErrors] = useState({});
  const [savingPw, setSavingPw] = useState(false);
  const prefs = { show_sources: true, compact_mode: false, auto_scroll: true, ...(user.chat_preferences || {}) };

  const saveName = async (e) => {
    e.preventDefault();
    const err = validateName(name);
    setNameError(err);
    if (err) return;
    setSavingName(true);
    try { await updateProfile({ full_name: name.trim() }); toast.success('Profile updated.'); }
    catch (er) { setNameError(errorMessage(er)); }
    finally { setSavingName(false); }
  };

  const setPref = async (key, value) => {
    try { await updateProfile({ chat_preferences: { [key]: value } }); }
    catch (er) { toast.error(errorMessage(er, 'Could not save the preference.')); }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    const errs = {
      current: pw.current ? '' : 'Enter your current password.',
      next: validatePassword(pw.next) || (pw.next && pw.next === pw.current ? 'Choose a different password from the current one.' : ''),
      confirm: pw.confirm !== pw.next ? 'Passwords do not match.' : '',
    };
    setPwErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setSavingPw(true);
    try {
      await changePassword(pw.current, pw.next);
      setPw({ current: '', next: '', confirm: '' });
      toast.success('Password changed. Other devices have been signed out.');
    } catch (er) {
      const msg = errorMessage(er, 'Could not change the password.');
      setPwErrors(er?.response?.status === 400 ? { current: msg } : { next: msg });
    } finally { setSavingPw(false); }
  };

  const setP = (k) => (e) => { setPw((p) => ({ ...p, [k]: e.target.value })); setPwErrors((x) => ({ ...x, [k]: '' })); };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900 dark:text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Manage your profile, appearance and security.</p>
      </div>

      <Section title="Profile" description="Your name is shown in the sidebar and in greetings.">
        <div className="mb-5 flex items-center gap-4">
          <Avatar name={user.full_name} size="lg" />
          <div className="min-w-0"><p className="truncate font-medium text-slate-900 dark:text-white">{user.email}</p>
            <div className="mt-1 flex items-center gap-2"><Badge tone={user.role === 'admin' ? 'violet' : 'blue'} className="capitalize">{user.role}</Badge><span className="text-xs text-slate-400">Joined {formatDate(user.created_at)}</span></div></div>
        </div>
        <form onSubmit={saveName} className="flex flex-col gap-3 sm:flex-row sm:items-start" noValidate>
          <TextInput label="Full name" icon={User} value={name} onChange={(e) => { setName(e.target.value); setNameError(''); }} error={nameError} className="flex-1" />
          <Button type="submit" loading={savingName} disabled={name.trim() === user.full_name} className="sm:mt-[27px]">Save</Button>
        </form>
        <TextInput label="Email" value={user.email} readOnly disabled className="mt-4" hint="Email cannot be changed." />
      </Section>

      <Section title="Appearance" description="Saved to your account, so it follows you across devices.">
        <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Theme">
          {[['light', 'Light', Sun], ['dark', 'Dark', Moon]].map(([v, label, Icon]) => (
            <button key={v} type="button" role="radio" aria-checked={theme === v} onClick={() => setTheme(v)}
              className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition ${theme === v ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-slate-200 hover:border-slate-300 dark:border-navy-700'}`}>
              <Icon className="h-5 w-5 text-brand-600 dark:text-brand-300" aria-hidden /><span className="text-sm font-medium text-slate-800 dark:text-slate-100">{label}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Chat preferences">
        <div className="divide-y divide-slate-100 dark:divide-navy-800">
          <Toggle label="Show sources under answers" description="Lists the documents and pages each answer was based on." checked={prefs.show_sources} onChange={(v) => setPref('show_sources', v)} />
          <Toggle label="Compact messages" description="Tighter spacing so more of the conversation fits on screen." checked={prefs.compact_mode} onChange={(v) => setPref('compact_mode', v)} />
          <Toggle label="Auto-scroll to new messages" description="Keeps the latest message in view." checked={prefs.auto_scroll} onChange={(v) => setPref('auto_scroll', v)} />
        </div>
      </Section>

      <Section title="Change password" description="You will stay signed in here; sessions on other devices end.">
        <form onSubmit={savePassword} className="max-w-sm space-y-4" noValidate>
          <PasswordInput label="Current password" autoComplete="current-password" value={pw.current} onChange={setP('current')} error={pwErrors.current} />
          <div>
            <PasswordInput label="New password" autoComplete="new-password" value={pw.next} onChange={setP('next')} error={pwErrors.next} />
            <PasswordChecklist checks={passwordChecks(pw.next)} />
          </div>
          <PasswordInput label="Confirm new password" autoComplete="new-password" value={pw.confirm} onChange={setP('confirm')} error={pwErrors.confirm} />
          <Button type="submit" icon={KeyRound} loading={savingPw}>Update password</Button>
        </form>
      </Section>

      <Section title="Session">
        <Button variant="danger-ghost" icon={LogOut} onClick={async () => { await logout(); navigate('/login', { replace: true }); }}>Sign out</Button>
      </Section>
    </div>
  );
}
