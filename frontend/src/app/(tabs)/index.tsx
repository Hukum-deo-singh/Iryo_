import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Avatar } from '@/components/art/Avatar';
import { Guide } from '@/components/art/Guide';
import { InsightList } from '@/components/dashboard/InsightList';
import { ProgressRing } from '@/components/dashboard/ProgressRing';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { Card } from '@/components/ui/Card';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { StateBlock } from '@/components/ui/StateBlock';
import { useAuth } from '@/context/AuthContext';
import { usePrefs, useStyles, useTheme } from '@/context/PrefsContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import { SPACING, type Theme } from '@/theme/tokens';
import type { HistoryRange } from '@/types/api';
import { firstName, formatDateTime, formatRelative, greeting } from '@/utils/format';

const RANGES: { value: HistoryRange; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
];

export default function DashboardScreen() {
  const s = useStyles(makeStyles);
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { prefs } = usePrefs();
  const [range, setRange] = useState<HistoryRange>('7d');
  const { phase, latest, points, errorMessage, refreshing, retry, refresh } = useDashboardData(range);

  const spo2 = useMemo(
    () => points.map((p) => ({ t: new Date(p.measuredAt).getTime(), v: p.spo2Percent })).filter((p) => Number.isFinite(p.t)),
    [points],
  );
  const temp = useMemo(
    () => points.map((p) => ({ t: new Date(p.measuredAt).getTime(), v: p.temperatureC })).filter((p) => Number.isFinite(p.t)),
    [points],
  );

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <Animated.View entering={FadeInDown.duration(400)} style={s.header}>
        <View style={s.headerText}>
          <Text style={s.title}>
            {greeting()}
            {user ? `, ${firstName(user.displayName)}` : ''}
          </Text>
          <Text style={s.subtitle}>{new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
        </View>
        <PressableScale accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => router.navigate('/profile')} style={s.avatarButton}>
          <Avatar presetId={prefs.avatar} size={54} still />
        </PressableScale>
      </Animated.View>

      {phase === 'loading' ? (
        <View style={s.loading} accessibilityLabel="Loading your readings">
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      ) : null}

      {phase === 'error' ? (
        <StateBlock icon="alert" title="We couldn’t load your readings" message={errorMessage} actionLabel="Try again" onAction={retry} />
      ) : null}

      {phase === 'ready' && !latest ? (
        <StateBlock
          art={<Guide width={104} pose="wave" />}
          title="Let’s take your first reading"
          message="Please go to the Device tab, connect your device and take a measurement. Your results will show up here."
          actionLabel="Go to Device"
          onAction={() => router.navigate('/device')}
        />
      ) : null}

      {phase === 'ready' && latest ? (
        <>
          <Animated.View entering={FadeInDown.delay(80).duration(450)}>
            <Card>
              <Text style={s.stamp}>Last recorded {formatRelative(latest.measuredAt)}</Text>
              <Text style={s.stampSub}>{formatDateTime(latest.measuredAt)}</Text>
              <View style={s.metrics}>
                <View style={s.metric}>
                  <ProgressRing value={latest.spo2Percent} label="Blood oxygen" />
                  <Text style={s.metricLabel}>Blood oxygen</Text>
                </View>
                <View style={s.metric}>
                  <View style={s.tempBox} accessible accessibilityLabel={`Temperature ${latest.temperatureC.toFixed(1)} degrees Celsius`}>
                    <Text style={s.tempValue}>
                      {latest.temperatureC.toFixed(1)}
                      <Text style={s.tempUnit}> °C</Text>
                    </Text>
                  </View>
                  <Text style={s.metricLabel}>Temperature</Text>
                </View>
              </View>
              {latest.heartRateBpm != null || latest.heightCm != null ? (
                <View style={s.extras}>
                  {latest.heartRateBpm != null ? <Stat label="Heart rate" value={String(Math.round(latest.heartRateBpm))} unit="bpm" /> : null}
                  {latest.heightCm != null ? <Stat label="Height" value={latest.heightCm.toFixed(1)} unit="cm" /> : null}
                </View>
              ) : null}
            </Card>
          </Animated.View>

          <InsightList items={latest.derived ?? []} />

          <Animated.View entering={FadeInDown.delay(200).duration(450)}>
            <Segmented options={RANGES} value={range} onChange={setRange} />
          </Animated.View>
          <TrendChart title="Blood oxygen" unit="%" decimals={0} cap={100} points={spo2} />
          <TrendChart title="Temperature" unit="°C" decimals={1} points={temp} />
        </>
      ) : null}
    </Screen>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  const s = useStyles(makeStyles);
  return (
    <View style={s.stat} accessible accessibilityLabel={`${label} ${value} ${unit}`}>
      <Text style={s.statLabel}>{label}</Text>
      <Text style={s.statValue}>
        {value}
        <Text style={s.statUnit}> {unit}</Text>
      </Text>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    extras: { flexDirection: 'row', justifyContent: 'space-around', gap: SPACING.lg, marginTop: SPACING.lg, paddingTop: SPACING.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
    stat: { alignItems: 'center', gap: 2 },
    statLabel: { fontSize: 13, fontWeight: '600', color: t.textSecondary },
    statValue: { fontSize: 22, fontWeight: '800', color: t.text, letterSpacing: -0.3 },
    statUnit: { fontSize: 13, fontWeight: '600', color: t.textSecondary },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.md },
    headerText: { flex: 1, gap: 2 },
    title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, color: t.text },
    subtitle: { fontSize: 14, color: t.textSecondary },
    avatarButton: { width: 54, height: 54, borderRadius: 27, overflow: 'hidden', backgroundColor: t.inset, borderWidth: 1, borderColor: t.border },
    loading: { paddingVertical: SPACING.xxl * 2, alignItems: 'center' },
    stamp: { fontSize: 15, fontWeight: '700', color: t.text },
    stampSub: { fontSize: 13, color: t.textSecondary },
    metrics: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginTop: SPACING.lg, gap: SPACING.lg },
    metric: { alignItems: 'center', gap: SPACING.sm },
    metricLabel: { fontSize: 14, fontWeight: '600', color: t.textSecondary },
    tempBox: { width: 116, height: 116, borderRadius: 58, alignItems: 'center', justifyContent: 'center', backgroundColor: t.inset, borderWidth: 1.5, borderTopColor: t.insetEdgeDark, borderLeftColor: t.insetEdgeDark, borderBottomColor: t.insetEdgeLight, borderRightColor: t.insetEdgeLight },
    tempValue: { fontSize: 30, fontWeight: '800', color: t.text, letterSpacing: -0.5 },
    tempUnit: { fontSize: 15, fontWeight: '600', color: t.textSecondary },
  });
