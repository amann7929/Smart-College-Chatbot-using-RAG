import api from './client';
export { errorMessage, fieldErrors } from './client';

const data = (p) => p.then((r) => r.data);

export const authApi = {
  register: (body) => data(api.post('/auth/register', body)),
  login: (body) => data(api.post('/auth/login', body)),
  logout: () => api.post('/auth/logout'),
  me: () => data(api.get('/auth/me')),
};

export const usersApi = {
  update: (body) => data(api.patch('/users/me', body)),
  changePassword: (body) => data(api.post('/users/me/change-password', body)),
};

export const chatsApi = {
  list: (params) => data(api.get('/chats', { params })),
  create: (title) => data(api.post('/chats', title ? { title } : {})),
  get: (id) => data(api.get(`/chats/${id}`)),
  rename: (id, title) => data(api.patch(`/chats/${id}`, { title })),
  remove: (id) => api.delete(`/chats/${id}`),
  clear: (id) => api.delete(`/chats/${id}/messages`),
  // Answering involves embedding + vector search + the LLM, so allow a longer timeout.
  send: (id, content) => data(api.post(`/chats/${id}/messages`, { content }, { timeout: 120000 })),
  retry: (chatId, messageId) => data(api.post(`/chats/${chatId}/messages/${messageId}/retry`, null, { timeout: 120000 })),
  setFeedback: (messageId, rating) => data(api.put(`/messages/${messageId}/feedback`, { rating })),
  removeFeedback: (messageId) => api.delete(`/messages/${messageId}/feedback`),
};

export const docsApi = {
  categories: () => data(api.get('/documents/categories')),
  list: (params) => data(api.get('/documents', { params })),
  upload: (file, category, onProgress) => {
    const form = new FormData();
    form.append('file', file);
    form.append('category', category);
    return data(api.post('/documents', form, {
      timeout: 300000,
      onUploadProgress: (e) => onProgress && e.total && onProgress(Math.round((e.loaded / e.total) * 100)),
    }));
  },
  retry: (id) => data(api.post(`/documents/${id}/retry`)),
  remove: (id) => api.delete(`/documents/${id}`),
};

export const adminApi = {
  stats: () => data(api.get('/admin/stats')),
  usage: (days) => data(api.get('/admin/usage', { params: { days } })),
  activity: (limit = 15) => data(api.get('/admin/activity', { params: { limit } })),
  feedback: () => data(api.get('/admin/feedback-summary')),
  users: (params) => data(api.get('/admin/users', { params })),
  updateUser: (id, body) => data(api.patch(`/admin/users/${id}`, body)),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
};
