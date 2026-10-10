import type { Store } from './store';
import { backendRequest, cloudMode } from './backend';

type RequestOptions = {
  method?: 'GET' | 'POST';
  body?: Record<string, unknown>;
  snapshot?: Store;
  actor?: { id?: string; name?: string; email?: string };
};

export class ApiClientError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Club-scoped demo API helper. Commerce routes receive the browser store snapshot. */
export async function clubRequest<T>(
  clubId: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const method = options.method || 'POST';
  const payload: Record<string, unknown> = {
    clubId,
    ...(options.body || {}),
  };
  if (options.snapshot && !cloudMode) payload.snapshot = options.snapshot;
  if (options.actor && !cloudMode) payload.actor = options.actor;
  if (cloudMode) {
    if (method === 'POST' && !payload.idempotencyKey) payload.idempotencyKey = crypto.randomUUID();
    const result = await backendRequest<T>(path, { method, body: method === 'GET' ? undefined : JSON.stringify(payload) });
    window.dispatchEvent(new Event('skyline-data-changed'));
    return result;
  }

  const response = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok)
    throw new ApiClientError(response.status, data.error || 'The demo API could not complete this action.');
  return data;
}
