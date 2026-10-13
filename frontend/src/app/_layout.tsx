import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AuthProvider, useAuth } from '@/context/AuthContext';
import { WakeScreen } from '@/components/ServerGate';
import { PrefsProvider, usePrefs } from '@/context/PrefsContext';
import { useServerWake } from '@/hooks/useServerWake';

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { status } = useAuth();
  const { ready, theme } = usePrefs();
  const loading = status === 'loading' || !ready;
  const wake = useServerWake();
  const [booted, setBooted] = useState(false);

  // The app screens appear once the server has answered for the first time, then stay mounted.
  useEffect(() => {
    if (wake.phase === 'online') setBooted(true);
  }, [wake.phase]);

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync();
  }, [loading]);

  if (loading) return null;

  const signedIn = status === 'signedIn';
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      {booted ? (
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }}>
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="(tabs)" />
          </Stack.Protected>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
        </Stack>
      ) : null}
      {wake.phase !== 'online' ? (
        <WakeScreen phase={wake.phase} attempts={wake.attempts} elapsedMs={wake.elapsedMs} onRetry={wake.retry} />
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  return (
    <PrefsProvider>
      <AuthProvider>
        <RootStack />
      </AuthProvider>
    </PrefsProvider>
  );
}
