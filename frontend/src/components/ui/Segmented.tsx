import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

import { usePrefs, useStyles } from '@/context/PrefsContext';
import { MIN_TOUCH, RADII, type Theme } from '@/theme/tokens';

import { PressableScale } from './PressableScale';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (next: T) => void;
}

/** Segmented control with a sliding thumb. */
export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  const s = useStyles(makeStyles);
  const { prefs } = usePrefs();
  const reduce = useReducedMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segment = width > 0 ? (width - 8) / options.length : 0;
  const x = useSharedValue(0);

  useEffect(() => {
    const target = index * segment;
    x.value = prefs.motion && !reduce ? withSpring(target, { damping: 20, stiffness: 260 }) : target;
  }, [index, segment, prefs.motion, reduce, x]);

  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={s.track} accessibilityRole="tablist" onLayout={onLayout}>
      {segment > 0 ? <Animated.View style={[s.thumb, { width: segment }, thumb]} /> : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressableScale
            key={option.value}
            scaleTo={0.97}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={s.option}
          >
            <Text style={[s.text, selected && s.selectedText]}>{option.label}</Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    track: {
      flexDirection: 'row',
      padding: 4,
      borderRadius: RADII.lg,
      backgroundColor: t.inset,
      borderWidth: 1.5,
      borderTopColor: t.insetEdgeDark,
      borderLeftColor: t.insetEdgeDark,
      borderBottomColor: t.insetEdgeLight,
      borderRightColor: t.insetEdgeLight,
    },
    thumb: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: RADII.md, backgroundColor: t.accent },
    option: { flex: 1, minHeight: MIN_TOUCH - 8, alignItems: 'center', justifyContent: 'center' },
    text: { fontSize: 15, fontWeight: '600', color: t.textSecondary },
    selectedText: { color: t.onAccent },
  });
