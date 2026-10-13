import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { Guide, type GuidePose } from '@/components/art/Guide';
import { DeviceIllustration } from '@/components/art/DeviceIllustration';
import { Card } from '@/components/ui/Card';
import { PressableScale } from '@/components/ui/PressableScale';
import { useStyles, useTheme } from '@/context/PrefsContext';
import { RADII, SPACING, type Theme } from '@/theme/tokens';

const STEPS: { title: string; text: string; pose: GuidePose; sensor: boolean }[] = [
  { title: 'Switch on your device', text: 'Press the power button and wait for the light.', pose: 'wave', sensor: false },
  { title: 'Enter the Device ID', text: 'Type the ID printed on the back and tap Connect.', pose: 'point', sensor: false },
  { title: 'Take your reading', text: 'Rest a finger on the sensor, then stand under the height sensor.', pose: 'point', sensor: true },
];

const STEP_MS = 3600;

/** A short, looping three-step guide told by the little boy. */
export function HowItWorks() {
  const s = useStyles(makeStyles);
  const theme = useTheme();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % STEPS.length), STEP_MS);
    return () => clearInterval(id);
  }, [index]);

  const step = STEPS[index];

  return (
    <Card>
      <Text accessibilityRole="header" style={s.heading}>
        How it works
      </Text>
      <View style={s.stage}>
        <Guide width={92} pose={step.pose} />
        <DeviceIllustration width={78} highlightSensor={step.sensor} />
      </View>
      <Animated.View key={index} entering={FadeIn.duration(300)} exiting={FadeOut.duration(150)} style={s.caption}>
        <Text style={s.stepTitle}>
          {index + 1}. {step.title}
        </Text>
        <Text style={s.stepText}>{step.text}</Text>
      </Animated.View>
      <View style={s.dots}>
        {STEPS.map((_, i) => (
          <PressableScale
            key={i}
            accessibilityRole="button"
            accessibilityLabel={`Show step ${i + 1}`}
            hitSlop={10}
            onPress={() => setIndex(i)}
            style={[s.dot, { backgroundColor: i === index ? theme.accent : theme.border, width: i === index ? 22 : 8 }]}
          />
        ))}
      </View>
    </Card>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    heading: { fontSize: 18, fontWeight: '700', color: t.text },
    stage: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: SPACING.xl, marginTop: SPACING.md, minHeight: 124 },
    caption: { alignItems: 'center', gap: 2, marginTop: SPACING.md, minHeight: 48 },
    stepTitle: { fontSize: 16, fontWeight: '700', color: t.text },
    stepText: { fontSize: 14, color: t.textSecondary, textAlign: 'center' },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: SPACING.md },
    dot: { height: 8, borderRadius: RADII.round },
  });
