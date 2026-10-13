import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';

import { AVATAR_EYES_PIVOT, AVATAR_PRESETS, avatarBodySvg, avatarEyesSvg } from '@/art/svgs';
import { usePrefs, useTheme } from '@/context/PrefsContext';

interface Props {
  presetId: string;
  size: number;
  /** Turn off blinking and floating, for small thumbnails. */
  still?: boolean;
}

/** Anime-style profile character with a gentle float and blink. */
export function Avatar({ presetId, size, still = false }: Props) {
  const theme = useTheme();
  const { prefs } = usePrefs();
  const reduce = useReducedMotion();
  const animate = prefs.motion && !reduce && !still;
  const preset = AVATAR_PRESETS.find((p) => p.id === presetId) ?? AVATAR_PRESETS[0];

  const body = useMemo(() => avatarBodySvg(preset, theme.accent), [preset, theme.accent]);
  const eyes = useMemo(() => avatarEyesSvg(preset), [preset]);

  const blink = useSharedValue(1);
  const float = useSharedValue(0);

  useEffect(() => {
    if (!animate) return;
    blink.value = withRepeat(
      withSequence(withDelay(3200, withTiming(0.08, { duration: 90 })), withTiming(1, { duration: 150 })),
      -1,
      false,
    );
    float.value = withRepeat(
      withSequence(
        withTiming(-size * 0.025, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(blink);
      cancelAnimation(float);
    };
  }, [animate, size, blink, float]);

  const floatStyle = useAnimatedStyle(() => ({ transform: [{ translateY: float.value }] }));
  const eyeStyle = useAnimatedStyle(() => ({
    transformOrigin: `50% ${AVATAR_EYES_PIVOT.y * 100}%`,
    transform: [{ scaleY: blink.value }],
  }));

  return (
    <View style={{ width: size, height: size }} accessible accessibilityRole="image" accessibilityLabel="Your avatar">
      <Animated.View style={[StyleSheet.absoluteFill, floatStyle]}>
        <SvgXml xml={body} width={size} height={size} />
        <Animated.View style={[StyleSheet.absoluteFill, eyeStyle]}>
          <SvgXml xml={eyes} width={size} height={size} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}
