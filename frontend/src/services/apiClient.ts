import type { ApiErrorBody } from '@/types/api';

const BASE_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
const TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

interface ClientHooks {
  getToken: () => string | null;
  onUnauthorized: () => void;
}

let hooks: ClientHooks = { getToken: () => null, onUnauthorized: () => {} };
let unreachableListener: (() => void) | null = null;

export function configureApiClient(next: ClientHooks): void {
  hooks = next;
}

/** Called when a request fails because the server could not be reached (for example, it went to sleep). */
export function setUnreachableListener(listener: (() => void) | null): void {
  unreachableListener = listener;
}

export function getBaseUrl(): string {
  return BASE_URL;
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  /** Set false for public endpoints such as login and signup. */
  auth?: boolean;
}

const GENERIC_SERVER = 'Something went wrong on our side. Please try again in a moment.';

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true } = options;

  if (!BASE_URL) {
    throw new ApiError(0, 'UNAVAILABLE', 'Iryo is unavailable right now. Please try again later.');
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = hooks.getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    unreachableListener?.();
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(0, 'TIMEOUT', 'The request took too long. Check your connection and try again.');
    }
    throw new ApiError(0, 'NETWORK', 'Connection interrupted. Check your internet and try again.');
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return undefined as T;

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.ok) return payload as T;

  if (response.status === 401 && auth) hooks.onUnauthorized();
  if (response.status === 502 || response.status === 503 || response.status === 504) unreachableListener?.();

  const errorBody = (payload ?? {}) as Partial<ApiErrorBody>;
  const code = typeof errorBody.code === 'string' ? errorBody.code : 'UNKNOWN';
  const message =
    response.status >= 500 || typeof errorBody.message !== 'string' || !errorBody.message
      ? GENERIC_SERVER
      : errorBody.message;
  throw new ApiError(response.status, code, message);
}
