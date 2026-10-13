import type { Device } from '@/types/api';

import { ApiError, request } from './apiClient';

/** Returns the linked device, or null when the user has none. */
export async function getMyDevice(): Promise<Device | null> {
  try {
    return await request<Device>('/api/devices/me');
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export const assignDevice = (deviceId: string) =>
  request<Device>('/api/devices/assign', { method: 'POST', body: { deviceId } });
