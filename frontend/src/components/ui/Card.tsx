import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useStyles, useTheme } from '@/context/PrefsContext';
import { RADII, SPACING, type Theme } from '@/theme/tokens';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}

/** Soft raised surface. Depth comes from one gentle shadow and a light top edge, nothing louder. */
export function Card({ children, style, padded = true }: Props) {
  const s = useStyles(makeStyles);
  const theme = useTheme();
  return (
    <View style={[s.shadow, style]}>
      <LinearGradient colors={[theme.surfaceHi, theme.surface]} style={[s.surface, padded && s.padded]}>
        {children}
      </LinearGradient>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    shadow: {
      borderRadius: RADII.xl,
      ...Platform.select<ViewStyle>({
        ios: { shadowColor: t.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: t.isDark ? 0.5 : 0.28, shadowRadius: 16 },
        android: { elevation: t.isDark ? 2 : 4, shadowColor: t.shadow },
        default: { boxShadow: `0px 8px 20px ${t.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(141,150,143,0.35)'}` } as ViewStyle,
      }),
    },
    surface: {
      borderRadius: RADII.xl,
      borderWidth: 1,
      borderColor: t.isDark ? t.border : 'rgba(255,255,255,0.9)',
      overflow: 'hidden',
    },
    padded: { padding: SPACING.lg },
  });
