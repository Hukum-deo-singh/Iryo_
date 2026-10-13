import { ActivityIndicator, StyleSheet, Text } from 'react-native';

import { useStyles, useTheme } from '@/context/PrefsContext';
import { MIN_TOUCH, RADII, type Theme } from '@/theme/tokens';

import { PressableScale } from './PressableScale';

interface Props {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
}

export function Button({ title, onPress, variant = 'primary', loading = false, disabled = false }: Props) {
  const s = useStyles(makeStyles);
  const theme = useTheme();
  const primary = variant === 'primary';
  const inactive = disabled || loading;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={[s.base, primary ? s.primary : s.secondary, inactive && s.inactive]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? theme.onAccent : theme.accent} />
      ) : (
        <Text style={[s.label, { color: primary ? theme.onAccent : theme.text }]}>{title}</Text>
      )}
    </PressableScale>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    base: {
      minHeight: MIN_TOUCH + 6,
      borderRadius: RADII.lg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    primary: { backgroundColor: t.accent },
    secondary: { backgroundColor: t.surfaceHi, borderWidth: 1, borderColor: t.border },
    inactive: { opacity: 0.55 },
    label: { fontSize: 17, fontWeight: '700', letterSpacing: 0.2 },
  });
