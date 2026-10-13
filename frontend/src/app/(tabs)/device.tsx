import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';

import { Guide } from '@/components/art/Guide';
import { HowItWorks } from '@/components/device/HowItWorks';
import { SessionTimer } from '@/components/device/SessionTimer';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { StateBlock } from '@/components/ui/StateBlock';
import { useStyles, useTheme } from '@/context/PrefsContext';
import { useDeviceSession } from '@/hooks/useDeviceSession';
import { ApiError } from '@/services/apiClient';
import { fx } from '@/services/feedback';
import { SPACING, type Theme } from '@/theme/tokens';
import { validateDeviceId } from '@/utils/validation';

export default function DeviceScreen() {
  const s = useStyles(makeStyles);
  const theme = useTheme();
  const router = useRouter();
  const session = useDeviceSession();
  const [deviceId, setDeviceId] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    const problem = validateDeviceId(deviceId);
    setFieldError(problem);
    setFormError(null);
    if (problem) {
      fx.error();
      return;
    }
    setBusy(true);
    try {
      await session.connect(deviceId.trim());
      fx.success();
      setDeviceId('');
    } catch (error) {
      fx.error();
      setFormError(
        error instanceof ApiError ? error.message : 'We couldn’t connect your device. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Animated.View entering={FadeInDown.duration(400)}>
        <Text style={s.title}>Device</Text>
        <Text style={s.subtitle}>Connect for a short session and take a reading.</Text>
      </Animated.View>

      {session.phase === 'loading' ? (
        <View style={s.loading} accessibilityLabel="Loading your device">
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : null}

      {session.phase === 'error' ? (
        <StateBlock icon="alert" title="We couldn’t load your device" message={session.loadError} actionLabel="Try again" onAction={session.load} />
      ) : null}

      {session.phase === 'ready' && !session.device ? (
        <>
          <Animated.View entering={FadeInDown.delay(80).duration(450)}>
            <HowItWorks />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(160).duration(450)}>
            <Card>
              <View style={s.form}>
                <Text style={s.heading}>Connect your device</Text>
                <Text style={s.subtitle}>
                  Enter the Device ID printed on it. It stays linked to you for about 2 minutes so you can take a measurement.
                </Text>
                <Field
                  label="Device ID"
                  value={deviceId}
                  onChangeText={setDeviceId}
                  error={fieldError}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={connect}
                />
                {formError ? (
                  <Text accessibilityLiveRegion="polite" style={s.formError}>
                    {formError}
                  </Text>
                ) : null}
                <Button title="Connect device" onPress={connect} loading={busy} />
              </View>
            </Card>
          </Animated.View>
        </>
      ) : null}

      {session.phase === 'ready' && session.device && session.active && !session.reading ? (
        <Animated.View entering={FadeInDown.duration(450)}>
          <Card>
            <View style={s.center}>
              <SessionTimer remaining={session.remaining} total={session.total} />
              <Text style={s.heading}>Take your reading now</Text>
              <Text style={[s.subtitle, s.centerText]}>
                {session.device.deviceId} is linked to you. Follow the steps on the device screen. Your result appears here automatically.
              </Text>
              <Guide width={86} pose="point" />
            </View>
          </Card>
        </Animated.View>
      ) : null}

      {session.phase === 'ready' && session.reading ? (
        <Animated.View entering={ZoomIn.duration(400)}>
          <StateBlock
            art={
              <View style={s.check}>
                <Icon name="check" color={theme.onAccent} size={30} strokeWidth={3} />
              </View>
            }
            title="Reading received"
            message={`${Math.round(session.reading.spo2Percent)}% blood oxygen and ${session.reading.temperatureC.toFixed(1)} °C. It’s saved to your dashboard.`}
            actionLabel="View dashboard"
            onAction={() => router.navigate('/')}
          />
        </Animated.View>
      ) : null}

      {session.phase === 'ready' && session.ended && !session.reading ? (
        <StateBlock
          icon="device"
          title="Session ended"
          message="The device is free again and no reading arrived. Connect again whenever you’re ready."
          actionLabel="Start again"
          onAction={session.reset}
        />
      ) : null}

      {session.phase === 'ready' && session.ended && session.reading ? (
        <Button title="Start a new session" variant="secondary" onPress={session.reset} />
      ) : null}
    </Screen>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6, color: t.text },
    subtitle: { fontSize: 15, lineHeight: 22, color: t.textSecondary },
    heading: { fontSize: 18, fontWeight: '700', color: t.text },
    loading: { paddingVertical: SPACING.xxl * 2, alignItems: 'center' },
    form: { gap: SPACING.lg },
    formError: { color: t.danger, fontSize: 14, lineHeight: 20 },
    center: { alignItems: 'center', gap: SPACING.md },
    centerText: { textAlign: 'center' },
    check: { width: 60, height: 60, borderRadius: 30, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' },
  });
