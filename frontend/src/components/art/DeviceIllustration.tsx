import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';

import { deviceSvg } from '@/art/svgs';
import { usePrefs, useTheme } from '@/context/PrefsContext';

interface Props {
  width: number;
  /** Pulse a ring over the finger sensor. */
  highlightSensor?: boolean;
}

export function DeviceIllustration({ width, highlightSensor = false }: Props) {
  const theme = useTheme();
  const { prefs } = usePrefs();
  const reduce = useReducedMotion();
  const animate = prefs.motion && !reduce;
  const height = (width * 150) / 120;
  const xml = useMemo(
    () => deviceSvg(theme.isDark ? '#2A3230' : '#F4F5F2', theme.isDark ? '#0B0E0D' : '#2B2F36', theme.accent),
    [theme.isDark, theme.accent],
  );

  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!animate || !highlightSensor) {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 0 })), -1, false);
    return () => cancelAnimation(pulse);
  }, [animate, highlightSensor, pulse]);

  const ring = useAnimatedStyle(() => ({ opacity: 0.7 * (1 - pulse.value), transform: [{ scale: 1 + pulse.value * 1.1 }] }));
  const ringSize = (width * 30) / 120;

  return (
    <View style={{ width, height }}>
      <SvgXml xml={xml} width={width} height={height} />
      {highlightSensor ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              left: width / 2 - ringSize / 2,
              top: (height * 104) / 150 - ringSize / 2,
              borderColor: theme.accent,
            },
            ring,
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ ring: { position: 'absolute', borderWidth: 2 } });
