import axios from 'axios';

export const TOKEN_KEY = 'clgbot_token';
export const baseURL = import.meta.env.VITE_API_URL || '/api/v1';

const api = axios.create({ baseURL, timeout: 30000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// An expired/revoked token anywhere in the app logs the user out (login/register failures are normal 401s).
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    if (err.response?.status === 401 && !/\/auth\/(login|register|token)/.test(url) && localStorage.getItem(TOKEN_KEY)) {
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(err);
  },
);

/** Human-readable message for any axios error. Never exposes stack traces or internals. */
export function errorMessage(err, fallback = 'Something went wrong. Please try again.') {
  if (!err) return fallback;
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') return 'The request timed out. Please try again.';
  if (!err.response) return 'Cannot reach the server. Check your connection and that the backend is running.';
  const { status, data } = err.response;
  if (Array.isArray(data?.errors) && data.errors.length) return data.errors.map((e) => e.message).join(' ');
  if (typeof data?.detail === 'string') return data.detail;
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status >= 500) return 'The server had a problem. Please try again shortly.';
  return fallback;
}

/** {fieldName: message} from a FastAPI validation response, for inline form errors. */
export function fieldErrors(err) {
  const out = {};
  const list = err?.response?.data?.errors;
  if (Array.isArray(list)) for (const e of list) if (e.field && !out[e.field]) out[e.field] = e.message;
  return out;
}

export default api;
