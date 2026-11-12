export function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(iso, now = Date.now()) {
  if (!iso) return '';
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return formatDate(iso);
}

export function formatBytes(n) {
  if (n == null) return '-';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function pageLabel(s) {
  if (!s) return '';
  return s.page_start === s.page_end ? `p. ${s.page_start}` : `pp. ${s.page_start}-${s.page_end}`;
}

export function actionLabel(action = '') {
  const map = {
    'auth.login': 'Signed in', 'auth.logout': 'Signed out', 'auth.register': 'Registered', 'auth.login_failed': 'Failed sign-in',
    'user.change_password': 'Changed password', 'user.update_profile': 'Updated profile',
    'chat.delete': 'Deleted a chat', 'chat.clear': 'Cleared a chat',
    'document.upload': 'Uploaded document', 'document.retry': 'Retried indexing', 'document.delete': 'Deleted document',
    'document.seed': 'Imported document', 'document.delete_sample': 'Removed sample document',
    'admin.update_user': 'Updated a user', 'admin.delete_user': 'Deleted a user',
    'admin.create_cli': 'Admin created', 'admin.promote_cli': 'Admin promoted',
  };
  return map[action] || action.replace(/[._]/g, ' ');
}
