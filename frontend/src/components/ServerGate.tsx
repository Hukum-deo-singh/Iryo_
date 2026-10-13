import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Guide } from '@/components/art/Guide';
import { Button } from '@/components/ui/Button';
import { useStyles, useTheme } from '@/context/PrefsContext';
import type { WakePhase } from '@/hooks/useServerWake';
import { WAKE, isConfigured } from '@/services/serverStatus';
import { SPACING, type Theme } from '@/theme/tokens';

interface Props {
  phase: WakePhase;
  attempts: number;
  elapsedMs: number;
  onRetry: () => void;
}

/** Full-screen waiting view shown while the hosted server wakes up. */
export function WakeScreen({ phase, attempts, elapsedMs, onRetry }: Props) {
  const s = useStyles(makeStyles);
  const theme = useTheme();
  const share = Math.min(1, elapsedMs / WAKE.maxWaitMs);

  const title =
    phase === 'offline'
      ? isConfigured()
        ? 'We can’t reach the server'
        : 'The app isn’t set up yet'
      : phase === 'waking'
        ? 'Waking up the server'
        : 'Connecting to Iryo';
  const message =
    phase === 'offline'
      ? isConfigured()
        ? 'Check your internet connection, then try again.'
        : 'The server address is missing. Please contact support.'
      : phase === 'waking'
        ? 'Free hosting sleeps when it’s idle, so this can take up to 2 minutes. You don’t need to do anything.'
        : 'Checking that everything is ready.';

  return (
    <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(300)} style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[theme.bg, theme.bgAlt]} style={s.fill}>
        <View style={s.body}>
          <Guide width={120} pose="idle" />
          <Text accessibilityRole="header" accessibilityLiveRegion="polite" style={s.title}>
            {title}
          </Text>
          <Text style={s.message}>{message}</Text>

          {phase === 'offline' ? (
            isConfigured() ? (
              <View style={s.action}>
                <Button title="Try again" onPress={onRetry} />
              </View>
            ) : null
          ) : (
            <View style={s.status}>
              {phase === 'waking' ? (
                <View style={s.track} accessibilityLabel="Waiting for the server">
                  <View style={[s.fill2, { width: `${Math.max(6, share * 100)}%` }]} />
                </View>
              ) : (
                <ActivityIndicator color={theme.accent} />
              )}
              <Text style={s.small}>
                {phase === 'waking' ? `${Math.round(elapsedMs / 1000)} s · check ${attempts}` : `Check ${Math.max(1, attempts)}`}
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    fill: { flex: 1 },
    body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xxl, gap: SPACING.md },
    title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4, color: t.text, textAlign: 'center', marginTop: SPACING.md },
    message: { fontSize: 15, lineHeight: 22, color: t.textSecondary, textAlign: 'center', maxWidth: 320 },
    status: { alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.md, alignSelf: 'stretch' },
    track: { height: 6, alignSelf: 'stretch', maxWidth: 260, borderRadius: 3, backgroundColor: t.inset, overflow: 'hidden' },
    fill2: { height: 6, borderRadius: 3, backgroundColor: t.accent },
    small: { fontSize: 13, color: t.textSecondary },
    action: { alignSelf: 'stretch', maxWidth: 300, marginTop: SPACING.md },
  });
