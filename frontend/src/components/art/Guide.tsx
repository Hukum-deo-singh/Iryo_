import { useEffect, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
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

import { GUIDE_EYES_PIVOT, GUIDE_SHOULDER, guideArmSvg, guideBodySvg, guideEyesSvg } from '@/art/svgs';
import { usePrefs, useTheme } from '@/context/PrefsContext';

export type GuidePose = 'wave' | 'point' | 'idle';

interface Props {
  width: number;
  pose?: GuidePose;
  style?: StyleProp<ViewStyle>;
}

const REST: Record<GuidePose, number> = { wave: -150, point: -96, idle: 0 };

/** The little boy. He blinks, breathes, and waves or points. All motion runs on the UI thread. */
export function Guide({ width, pose = 'wave', style }: Props) {
  const theme = useTheme();
  const { prefs } = usePrefs();
  const reduce = useReducedMotion();
  const animate = prefs.motion && !reduce;
  const height = (width * 240) / 200;

  const body = useMemo(() => guideBodySvg(theme.accent), [theme.accent]);
  const arm = useMemo(() => guideArmSvg(theme.accent), [theme.accent]);
  const eyes = useMemo(() => guideEyesSvg(), []);

  const armAngle = useSharedValue(REST[pose]);
  const blink = useSharedValue(1);
  const bob = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(armAngle);
    if (!animate) {
      armAngle.value = REST[pose];
      return;
    }
    if (pose === 'wave') {
      armAngle.value = withSequence(
        withTiming(-150, { duration: 300 }),
        withRepeat(withSequence(withTiming(-128, { duration: 340 }), withTiming(-172, { duration: 340 })), -1, false),
      );
    } else if (pose === 'point') {
      armAngle.value = withSequence(
        withTiming(-96, { duration: 400, easing: Easing.out(Easing.cubic) }),
        withRepeat(withSequence(withTiming(-88, { duration: 500 }), withTiming(-100, { duration: 500 })), -1, false),
      );
    } else {
      armAngle.value = withTiming(0, { duration: 300 });
    }
    return () => cancelAnimation(armAngle);
  }, [pose, animate, armAngle]);

  useEffect(() => {
    if (!animate) return;
    blink.value = withRepeat(
      withSequence(withDelay(2800, withTiming(0.08, { duration: 90 })), withTiming(1, { duration: 140 })),
      -1,
      false,
    );
    bob.value = withRepeat(
      withSequence(
        withTiming(-3, { duration: 1000, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    return () => {
      cancelAnimation(blink);
      cancelAnimation(bob);
    };
  }, [animate, blink, bob]);

  const bobStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] }));
  const eyeStyle = useAnimatedStyle(() => ({
    transformOrigin: `50% ${GUIDE_EYES_PIVOT.y * 100}%`,
    transform: [{ scaleY: blink.value }],
  }));
  const armStyle = useAnimatedStyle(() => ({
    transformOrigin: `${GUIDE_SHOULDER.x * 100}% ${GUIDE_SHOULDER.y * 100}%`,
    transform: [{ rotate: `${armAngle.value}deg` }],
  }));

  return (
    <Animated.View style={[{ width, height }, bobStyle, style]} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={StyleSheet.absoluteFill}>
        <SvgXml xml={body} width={width} height={height} />
      </View>
      <Animated.View style={[StyleSheet.absoluteFill, armStyle]}>
        <SvgXml xml={arm} width={width} height={height} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, eyeStyle]}>
        <SvgXml xml={eyes} width={width} height={height} />
      </Animated.View>
    </Animated.View>
  );
}
