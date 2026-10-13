import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

import { usePrefs } from '@/context/PrefsContext';
import { fx } from '@/services/feedback';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Skip the click sound and haptic. */
  silent?: boolean;
  scaleTo?: number;
}

/** A pressable that squishes slightly, clicks, and vibrates lightly. */
export function PressableScale({ style, silent = false, scaleTo = 0.96, onPress, onPressIn, onPressOut, ...rest }: Props) {
  const { prefs } = usePrefs();
  const reduce = useReducedMotion();
  const animate = prefs.motion && !reduce;
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      style={[style, animate ? animatedStyle : null]}
      onPressIn={(e) => {
        if (animate) scale.value = withSpring(scaleTo, { damping: 18, stiffness: 400 });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (animate) scale.value = withSpring(1, { damping: 14, stiffness: 300 });
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (!silent) fx.tap();
        onPress?.(e);
      }}
    />
  );
}
