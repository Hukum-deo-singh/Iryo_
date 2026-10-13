import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiError } from '@/services/apiClient';
import { assignDevice, getMyDevice } from '@/services/deviceService';
import { fx } from '@/services/feedback';
import { getLatestMeasurement } from '@/services/measurementService';
import type { Device, Measurement } from '@/types/api';

type Phase = 'loading' | 'ready' | 'error';

const POLL_MS = 4000;

/**
 * A device is linked to you for a short session. This hook tracks the countdown,
 * and notices when a new reading arrives during the session.
 */
export function useDeviceSession() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [device, setDevice] = useState<Device | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [ended, setEnded] = useState(false);
  const [reading, setReading] = useState<Measurement | null>(null);
  const [total, setTotal] = useState(120);
  const [loadError, setLoadError] = useState('');
  const receivedAt = useRef(0);

  const adopt = useCallback((next: Device | null) => {
    setDevice(next);
    setEnded(false);
    setReading(null);
    receivedAt.current = Date.now();
    setRemaining(next ? next.remainingSeconds : 0);
    if (next) {
      const length = (new Date(next.assignedUntil).getTime() - new Date(next.assignedAt).getTime()) / 1000;
      if (Number.isFinite(length) && length > 0) setTotal(length);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      adopt(await getMyDevice());
      setPhase('ready');
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : 'We couldn’t load your device. Please try again.');
      setPhase('error');
    }
  }, [adopt]);

  // Refresh when the tab opens, unless we are showing the result of a finished session.
  useFocusEffect(
    useCallback(() => {
      if (!ended) void load();
    }, [load, ended]),
  );

  // Countdown, based on the seconds the server reported.
  useEffect(() => {
    if (!device || ended) return;
    const id = setInterval(() => {
      const left = device.remainingSeconds - (Date.now() - receivedAt.current) / 1000;
      if (left <= 0) {
        setRemaining(0);
        setEnded(true);
        fx.pop();
      } else {
        setRemaining(left);
      }
    }, 500);
    return () => clearInterval(id);
  }, [device, ended]);

  // Watch for a reading that arrived after this session began (both times come from the server).
  useEffect(() => {
    if (!device || ended || reading) return;
    let cancelled = false;
    const id = setInterval(async () => {
      try {
        const latest = await getLatestMeasurement();
        if (!cancelled && latest && new Date(latest.receivedAt).getTime() >= new Date(device.assignedAt).getTime()) {
          setReading(latest);
          fx.success();
        }
      } catch {
        // Keep waiting; the next poll will try again.
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [device, ended, reading]);

  const connect = useCallback(
    async (deviceId: string) => {
      adopt(await assignDevice(deviceId));
    },
    [adopt],
  );

  const reset = useCallback(() => {
    adopt(null);
    setPhase('ready');
  }, [adopt]);

  const active = !!device && !ended;
  return { phase, device, remaining, total, active, ended, reading, loadError, load, connect, reset };
}
