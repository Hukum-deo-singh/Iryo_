import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { usePrefs, useStyles, useTheme } from '@/context/PrefsContext';
import type { Theme } from '@/theme/tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  /** 0 to 100 */
  value: number;
  size?: number;
  label: string;
}

/** Ring that fills to the reading. It shows the number as a share of 100 and makes no medical judgement. */
export function ProgressRing({ value, size = 116, label }: Props) {
  const s = useStyles(makeStyles);
  const theme = useTheme();
  const { prefs } = usePrefs();
  const reduce = useReducedMotion();
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const target = Math.max(0, Math.min(1, value / 100));
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = prefs.motion && !reduce ? withTiming(target, { duration: 900, easing: Easing.out(Easing.cubic) }) : target;
  }, [target, prefs.motion, reduce, progress]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - progress.value) }));

  return (
    <View style={{ width: size, height: size }} accessible accessibilityLabel={`${label} ${Math.round(value)} percent`}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.inset} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={theme.accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={s.center} pointerEvents="none">
        <Text style={s.value}>
          {Math.round(value)}
          <Text style={s.unit}>%</Text>
        </Text>
      </View>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
    value: { fontSize: 30, fontWeight: '800', color: t.text, letterSpacing: -0.5 },
    unit: { fontSize: 16, fontWeight: '600', color: t.textSecondary },
  });
