import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

import { configureFeedback } from '@/services/feedback';
import { buildTheme, type AccentId, type ModePref, type Theme, type ToneId } from '@/theme/tokens';

/** Appearance and experience settings. They live on the phone only and never reach the backend. */
export interface Prefs {
  mode: ModePref;
  tone: ToneId;
  accent: AccentId;
  avatar: string;
  sound: boolean;
  haptics: boolean;
  motion: boolean;
}

const DEFAULTS: Prefs = {
  mode: 'system',
  tone: 'mist',
  accent: 'teal',
  avatar: 'midnight',
  sound: true,
  haptics: true,
  motion: true,
};

const KEY = 'iryo.prefs.v1';

interface PrefsValue {
  prefs: Prefs;
  ready: boolean;
  theme: Theme;
  setPrefs: (patch: Partial<Prefs>) => void;
}

const PrefsContext = createContext<PrefsValue | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setState] = useState<Prefs>(DEFAULTS);
  const [ready, setReady] = useState(false);
  const system = useColorScheme();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw && !cancelled) setState({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) });
      } catch {
        // Fall back to defaults.
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    configureFeedback({ sound: prefs.sound, haptics: prefs.haptics });
  }, [prefs.sound, prefs.haptics]);

  const setPrefs = useCallback((patch: Partial<Prefs>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const isDark = prefs.mode === 'system' ? system === 'dark' : prefs.mode === 'dark';
  const theme = useMemo(() => buildTheme(isDark, prefs.tone, prefs.accent), [isDark, prefs.tone, prefs.accent]);
  const value = useMemo(() => ({ prefs, ready, theme, setPrefs }), [prefs, ready, theme, setPrefs]);

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): PrefsValue {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('usePrefs must be used inside PrefsProvider');
  return ctx;
}

export function useTheme(): Theme {
  return usePrefs().theme;
}

/** Builds StyleSheets from the active theme. Pass a module-level factory so it stays stable. */
export function useStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<unknown>>(
  factory: (theme: Theme) => T,
): T {
  const theme = useTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}
