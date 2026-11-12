const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(v) {
  if (!v || !v.trim()) return 'Email is required.';
  if (!EMAIL_RE.test(v.trim())) return 'Enter a valid email address.';
  return '';
}

export function validateName(v) {
  if (!v || v.trim().length < 2) return 'Name must be at least 2 characters.';
  if (v.trim().length > 120) return 'Name must be at most 120 characters.';
  return '';
}

/** Same rules as the backend so users get instant feedback. */
export function passwordChecks(v = '') {
  return [
    { label: 'At least 8 characters', ok: v.length >= 8 },
    { label: 'One lowercase letter', ok: /[a-z]/.test(v) },
    { label: 'One uppercase letter', ok: /[A-Z]/.test(v) },
    { label: 'One digit', ok: /\d/.test(v) },
  ];
}

export function validatePassword(v = '') {
  if (!v) return 'Password is required.';
  if (v.length > 128) return 'Password must be at most 128 characters.';
  const failed = passwordChecks(v).find((c) => !c.ok);
  return failed ? `Password needs: ${failed.label.toLowerCase()}.` : '';
}
