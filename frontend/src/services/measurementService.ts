import type { HistoryRange, HistoryResponse, Measurement } from '@/types/api';

import { ApiError, request } from './apiClient';

/** Returns the latest stored measurement, or null when none exists yet. */
export async function getLatestMeasurement(): Promise<Measurement | null> {
  try {
    return await request<Measurement>('/api/measurements/latest');
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export const getHistory = (range: HistoryRange) =>
  request<HistoryResponse>(`/api/measurements/history?range=${range}`);
