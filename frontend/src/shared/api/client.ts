import { removeTrailingSlash } from '../../../../shared/schemas.js';

const env = (import.meta as unknown as { env?: Record<string, string> }).env || {};
export const cloudMode = env.VITE_BACKEND_MODE === 'aws';
const base = removeTrailingSlash(env.VITE_API_URL || '/api');
let csrfToken = '';
let refreshing: Promise<void> | null = null;
export function setCsrf(value: string) {
  csrfToken = value;
}
export function backendHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-skyline-client': 'web',
    ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
  };
}
export async function backendRequest<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-skyline-client': 'web',
      ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      ...options.headers,
    },
  });
  if (
    response.status === 401 &&
    retry &&
    !['/auth/login', '/auth/signup', '/auth/refresh'].includes(path)
  ) {
    if (!refreshing)
      refreshing = backendRequest<{ csrfToken: string }>(
        '/auth/refresh',
        { method: 'POST', body: '{}' },
        false,
      )
        .then((result) => {
          setCsrf(result.csrfToken);
        })
        .finally(() => {
          refreshing = null;
        });
    try {
      await refreshing;
    } catch (error) {
      window.dispatchEvent(new Event('skyline-session-expired'));
      throw error;
    }
    return backendRequest(path, options, false);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  if (data.csrfToken) setCsrf(data.csrfToken);
  return data;
}
export function backendPost<T>(path: string, body: unknown): Promise<T> {
  return backendRequest<T>(path, { method: 'POST', body: JSON.stringify(body) });
}
