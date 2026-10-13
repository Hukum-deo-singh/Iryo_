import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { setUnreachableListener } from '@/services/apiClient';
import { WAKE, isConfigured, pingServer } from '@/services/serverStatus';

export type WakePhase = 'checking' | 'waking' | 'online' | 'offline';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Makes sure the hosted server is awake. On open it checks every 5 seconds: the first few checks read
 * "Connecting", then "Waking up", then it offers Try again. While the app is open it keeps the server warm,
 * and it checks again by itself if a request ever fails because the server is unreachable.
 */
export function useServerWake() {
  const [phase, setPhase] = useState<WakePhase>('checking');
  const [attempts, setAttempts] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const runId = useRef(0);
  const phaseRef = useRef<WakePhase>('checking');
  const backgroundedAt = useRef<number | null>(null);

  const update = useCallback((next: WakePhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const start = useCallback(async () => {
    const id = ++runId.current;
    const startedAt = Date.now();
    update('checking');
    setAttempts(0);
    setElapsedMs(0);
    if (!isConfigured()) {
      update('offline');
      return;
    }
    let n = 0;
    while (id === runId.current) {
      const pingStartedAt = Date.now();
      n += 1;
      setAttempts(n);
      const ok = await pingServer();
      if (id !== runId.current) return;
      if (ok) {
        update('online');
        return;
      }
      const waited = Date.now() - startedAt;
      setElapsedMs(waited);
      if (waited >= WAKE.maxWaitMs) {
        update('offline');
        return;
      }
      update(n >= WAKE.quickAttempts ? 'waking' : 'checking');
      await sleep(Math.max(0, WAKE.pingEveryMs - (Date.now() - pingStartedAt)));
    }
  }, [update]);

  /** A quiet check while the app is in use. Shows the waiting screen only if the server really is down. */
  const quietCheck = useCallback(async () => {
    if (phaseRef.current !== 'online') return;
    if (await pingServer(8000)) return;
    await sleep(2000);
    if (phaseRef.current !== 'online') return;
    if (await pingServer(8000)) return;
    void start();
  }, [start]);

  useEffect(() => {
    void start();
    return () => {
      runId.current += 1;
    };
  }, [start]);

  // Keep the server warm while the app is open.
  useEffect(() => {
    if (phase !== 'online') return;
    const id = setInterval(() => void quietCheck(), WAKE.keepAliveEveryMs);
    return () => clearInterval(id);
  }, [phase, quietCheck]);

  // Check again when the app returns after a while in the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const away = backgroundedAt.current ? Date.now() - backgroundedAt.current : 0;
        backgroundedAt.current = null;
        if (away >= WAKE.recheckAfterBackgroundMs) void quietCheck();
      } else if (backgroundedAt.current === null) {
        backgroundedAt.current = Date.now();
      }
    });
    return () => sub.remove();
  }, [quietCheck]);

  // Any request that fails because the server is unreachable triggers a check (at most once every 5 seconds).
  useEffect(() => {
    let last = 0;
    setUnreachableListener(() => {
      const now = Date.now();
      if (now - last < 5000) return;
      last = now;
      void quietCheck();
    });
    return () => setUnreachableListener(null);
  }, [quietCheck]);

  return { phase, attempts, elapsedMs, retry: start };
}
