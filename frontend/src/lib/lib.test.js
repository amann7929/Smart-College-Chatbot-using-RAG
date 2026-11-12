import { describe, expect, it } from 'vitest';
import { actionLabel, formatBytes, initials, pageLabel, timeAgo } from './format';
import { passwordChecks, validateEmail, validateName, validatePassword } from './validation';
import { errorMessage, fieldErrors } from '../api/client';

describe('format helpers', () => {
  it('formats bytes, initials, page labels and relative time', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(initials('Riya Das')).toBe('RD');
    expect(initials('  madonna ')).toBe('M');
    expect(initials('')).toBe('?');
    expect(pageLabel({ page_start: 3, page_end: 3 })).toBe('p. 3');
    expect(pageLabel({ page_start: 3, page_end: 4 })).toBe('pp. 3-4');
    const now = new Date('2026-06-01T12:00:00Z').getTime();
    expect(timeAgo('2026-06-01T11:59:40Z', now)).toBe('just now');
    expect(timeAgo('2026-06-01T11:30:00Z', now)).toBe('30m ago');
    expect(timeAgo('2026-06-01T07:00:00Z', now)).toBe('5h ago');
    expect(timeAgo('2026-05-30T12:00:00Z', now)).toBe('2d ago');
  });
  it('translates audit actions into readable text', () => {
    expect(actionLabel('document.upload')).toBe('Uploaded document');
    expect(actionLabel('some.new_action')).toBe('some new action');
  });
});

describe('validation (mirrors backend rules)', () => {
  it('validates email and name', () => {
    expect(validateEmail('')).toMatch(/required/);
    expect(validateEmail('nope')).toMatch(/valid/);
    expect(validateEmail('a@b.co')).toBe('');
    expect(validateName('A')).toMatch(/2 characters/);
    expect(validateName('Ab')).toBe('');
  });
  it('validates passwords', () => {
    expect(validatePassword('')).toMatch(/required/);
    expect(validatePassword('short1A')).toMatch(/8 characters/);
    expect(validatePassword('alllowercase1')).toMatch(/uppercase/);
    expect(validatePassword('ALLUPPERCASE1')).toMatch(/lowercase/);
    expect(validatePassword('NoDigitsHere')).toMatch(/digit/);
    expect(validatePassword('StrongPass1')).toBe('');
    expect(passwordChecks('Abcdefg1').every((c) => c.ok)).toBe(true);
    expect(passwordChecks('abc').filter((c) => c.ok)).toHaveLength(1);
  });
});

describe('API error helpers', () => {
  const err = (status, data) => ({ response: { status, data } });
  it('maps responses to friendly messages', () => {
    expect(errorMessage(err(401, { detail: 'Invalid email or password.' }))).toBe('Invalid email or password.');
    expect(errorMessage(err(422, { detail: 'Validation failed.', errors: [{ field: 'password', message: 'Too weak.' }] }))).toBe('Too weak.');
    expect(errorMessage(err(429, {}))).toMatch(/Too many requests/);
    expect(errorMessage(err(500, {}))).toMatch(/server had a problem/);
    expect(errorMessage({ code: 'ECONNABORTED' })).toMatch(/timed out/);
    expect(errorMessage({})).toMatch(/Cannot reach the server/);
    expect(errorMessage(err(400, {}), 'Fallback text')).toBe('Fallback text');
  });
  it('extracts per-field errors', () => {
    expect(fieldErrors(err(422, { errors: [{ field: 'email', message: 'Bad email.' }, { field: 'email', message: 'dup' }] }))).toEqual({ email: 'Bad email.' });
    expect(fieldErrors({})).toEqual({});
  });
});
