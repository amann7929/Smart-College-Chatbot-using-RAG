import { vi } from 'vitest';

/** Factory for vi.mock('../api', ...): real error helpers, every endpoint is a vi.fn(). */
export async function createApiMock() {
  const actual = await vi.importActual('../api/client');
  const fns = (...names) => Object.fromEntries(names.map((n) => [n, vi.fn()]));
  return {
    errorMessage: actual.errorMessage,
    fieldErrors: actual.fieldErrors,
    authApi: fns('register', 'login', 'logout', 'me'),
    usersApi: fns('update', 'changePassword'),
    chatsApi: fns('list', 'create', 'get', 'rename', 'remove', 'clear', 'send', 'retry', 'setFeedback', 'removeFeedback'),
    docsApi: fns('categories', 'list', 'upload', 'retry', 'remove'),
    adminApi: fns('stats', 'usage', 'activity', 'feedback', 'users', 'updateUser', 'deleteUser'),
  };
}
