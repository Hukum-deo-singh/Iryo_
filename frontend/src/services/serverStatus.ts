import { getBaseUrl } from './apiClient';

/**
 * Free hosting puts the server to sleep after 15 idle minutes and takes up to a couple of minutes to wake it.
 * These numbers control how the app checks. Change them here, nowhere else.
 */
export const WAKE = {
  /** Time between checks. */
  pingEveryMs: 5000,
  /** A check that takes longer than this counts as a miss. */
  pingTimeoutMs: 5000,
  /** Checks shown as "Connecting" before we say the server is waking up. */
  quickAttempts: 4,
  /** Give up after this long and offer a Try again button. */
  maxWaitMs: 150_000,
  /** While the app is open, check this often so the server does not fall asleep. */
  keepAliveEveryMs: 9 * 60_000,
  /** After the app has been in the background this long, check again when it comes back. */
  recheckAfterBackgroundMs: 2 * 60_000,
} as const;

export function isConfigured(): boolean {
  return getBaseUrl().length > 0;
}

/** One cheap request to /api/health. Never throws. */
export async function pingServer(timeoutMs: number = WAKE.pingTimeoutMs): Promise<boolean> {
  if (!isConfigured()) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${getBaseUrl()}/api/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const body = (await response.json()) as { status?: string };
    return body.status === 'ok';
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
