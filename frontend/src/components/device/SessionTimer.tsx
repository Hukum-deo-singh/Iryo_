import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useStyles, useTheme } from '@/context/PrefsContext';
import type { Theme } from '@/theme/tokens';
import { formatClock } from '@/utils/format';

interface Props {
  remaining: number;
  total: number;
  size?: number;
}

/** Countdown ring for the device session. */
export function SessionTimer({ remaining, total, size = 132 }: Props) {
  const s = useStyles(makeStyles);
  const theme = useTheme();
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const share = Math.max(0, Math.min(1, remaining / Math.max(total, 1)));

  return (
    <View style={{ width: size, height: size }} accessible accessibilityLabel={`${formatClock(remaining)} left in this session`}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.inset} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={theme.accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - share)}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={s.center} pointerEvents="none">
        <Text style={s.time}>{formatClock(remaining)}</Text>
        <Text style={s.caption}>left</Text>
      </View>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
    time: { fontSize: 30, fontWeight: '800', color: t.text, fontVariant: ['tabular-nums'] },
    caption: { fontSize: 13, color: t.textSecondary },
  });
