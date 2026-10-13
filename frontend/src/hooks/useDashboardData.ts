import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

import { ApiError } from '@/services/apiClient';
import { getHistory, getLatestMeasurement } from '@/services/measurementService';
import type { HistoryPoint, HistoryRange, Measurement } from '@/types/api';

type Phase = 'loading' | 'ready' | 'error';

/** Loads this user's own readings. They stay available after the device session ends. */
export function useDashboardData(range: HistoryRange) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [latest, setLatest] = useState<Measurement | null>(null);
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    try {
      const [nextLatest, history] = await Promise.all([getLatestMeasurement(), getHistory(range)]);
      if (id !== requestId.current) return;
      setLatest(nextLatest);
      setPoints(history.points);
      setErrorMessage('');
      setPhase('ready');
    } catch (error) {
      if (id !== requestId.current) return;
      setErrorMessage(error instanceof ApiError ? error.message : 'We couldn’t load your readings. Please try again.');
      setPhase('error');
    }
  }, [range]);

  // Reload whenever the tab is shown or the range changes. Later loads stay silent.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const retry = useCallback(() => {
    setPhase('loading');
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return { phase, latest, points, errorMessage, refreshing, retry, refresh };
}
