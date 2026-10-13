import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { AuthResponse } from '@/types/api';

const KEY = 'iryo.session';

/** Web has no secure storage, so the session lives in memory there only. */
let memorySession: string | null = null;

export async function saveSession(session: AuthResponse): Promise<void> {
  const raw = JSON.stringify(session);
  if (Platform.OS === 'web') {
    memorySession = raw;
    return;
  }
  await SecureStore.setItemAsync(KEY, raw);
}

export async function loadSession(): Promise<AuthResponse | null> {
  try {
    const raw = Platform.OS === 'web' ? memorySession : await SecureStore.getItemAsync(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AuthResponse>;
    if (!parsed.accessToken || !parsed.expiresAt || !parsed.user) return null;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) {
      await clearSession();
      return null;
    }
    return parsed as AuthResponse;
  } catch {
    await clearSession();
    return null;
  }
}

export async function clearSession(): Promise<void> {
  memorySession = null;
  if (Platform.OS === 'web') return;
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Nothing else to clean up.
  }
}
