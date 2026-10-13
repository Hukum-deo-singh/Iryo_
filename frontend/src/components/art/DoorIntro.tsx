import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';

import { doorLeafSvg, doorwaySvg } from '@/art/svgs';
import { Guide } from '@/components/art/Guide';
import { useTheme } from '@/context/PrefsContext';
import { authIntro } from '@/context/authIntro';
import { fx } from '@/services/feedback';

interface Props {
  kind: 'login' | 'signup';
  title: string;
  onDone: () => void;
}

const STAGE_W = 190;
const STAGE_H = 279;
const K = STAGE_W / 170;

/** A character knocks, the door swings open, he waves, then the page appears. Tap to skip. */
export function DoorIntro({ kind, title, onDone }: Props) {
  const theme = useTheme();
  const door = useSharedValue(0);
  const shake = useSharedValue(0);
  const guideIn = useSharedValue(0);
  const content = useSharedValue(1);
  const label = useSharedValue(0);
  const finished = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    authIntro.markSeen(kind);
    onDone();
  }, [kind, onDone]);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
    const knock = () => {
      fx.knock();
      shake.value = withSequence(withTiming(-3, { duration: 45 }), withTiming(3, { duration: 45 }), withTiming(0, { duration: 45 }));
    };
    at(350, knock);
    at(720, knock);
    at(1150, () => {
      fx.door();
      door.value = withTiming(-78, { duration: 850, easing: Easing.out(Easing.cubic) });
    });
    at(1280, () => {
      guideIn.value = withSpring(1, { damping: 12, stiffness: 120 });
      label.value = withDelay(250, withTiming(1, { duration: 400 }));
    });
    at(2450, () => {
      content.value = withTiming(0, { duration: 350 });
    });
    at(2850, finish);
    return () => timers.forEach(clearTimeout);
  }, [door, shake, guideIn, label, content, finish]);

  const leafXml = useMemo(
    () => doorLeafSvg(theme.doorLeaf, theme.doorPanel, theme.doorFrame),
    [theme.doorLeaf, theme.doorPanel, theme.doorFrame],
  );
  const frameXml = useMemo(() => doorwaySvg(theme.doorFrame, theme.doorGlow), [theme.doorFrame, theme.doorGlow]);

  const leafStyle = useAnimatedStyle(() => ({
    transformOrigin: 'left center',
    transform: [{ translateX: shake.value }, { perspective: 800 }, { rotateY: `${door.value}deg` }],
  }));
  const guideStyle = useAnimatedStyle(() => ({
    opacity: guideIn.value,
    transform: [{ translateY: (1 - guideIn.value) * 36 }, { scale: 0.9 + guideIn.value * 0.1 }],
  }));
  const labelStyle = useAnimatedStyle(() => ({ opacity: label.value, transform: [{ translateY: (1 - label.value) * 10 }] }));
  const contentStyle = useAnimatedStyle(() => ({ opacity: content.value }));

  return (
    <LinearGradient colors={[theme.bg, theme.bgAlt]} style={styles.fill}>
      <Pressable accessibilityRole="button" accessibilityLabel="Skip intro" onPress={finish} style={styles.fill}>
        <Animated.View style={[styles.center, contentStyle]}>
          <View style={{ width: STAGE_W, height: STAGE_H }}>
            <SvgXml xml={frameXml} width={STAGE_W} height={STAGE_H} />
            <Animated.View style={[styles.guide, guideStyle]}>
              <Guide width={112} pose="wave" />
            </Animated.View>
            <Animated.View style={[styles.leaf, { left: 12 * K, top: 12 * K, width: 146 * K, height: 236 * K }, leafStyle]}>
              <SvgXml xml={leafXml} width={146 * K} height={236 * K} />
            </Animated.View>
          </View>
          <Animated.View style={labelStyle}>
            <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          </Animated.View>
          <Text style={[styles.skip, { color: theme.textSecondary }]}>Tap to skip</Text>
        </Animated.View>
      </Pressable>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24 },
  guide: { position: 'absolute', left: (STAGE_W - 112) / 2, bottom: 6 },
  leaf: { position: 'absolute' },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.4 },
  skip: { fontSize: 13, position: 'absolute', bottom: 48 },
});
