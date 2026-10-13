import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { PressableScale } from '@/components/ui/PressableScale';
import { useStyles, useTheme } from '@/context/PrefsContext';
import { MIN_TOUCH, RADII, SPACING, type Theme } from '@/theme/tokens';

interface Props extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | null;
  secure?: boolean;
}

/** A recessed input. The border lights up in the accent colour on focus. */
export function Field({ label, error, secure = false, ...inputProps }: Props) {
  const s = useStyles(makeStyles);
  const theme = useTheme();
  const [hidden, setHidden] = useState(secure);
  const [focused, setFocused] = useState(false);

  return (
    <View style={s.group}>
      <Text style={s.label}>{label}</Text>
      <View style={[s.inset, focused && { borderColor: theme.accent }, !!error && { borderColor: theme.danger }]}>
        <TextInput
          {...inputProps}
          accessibilityLabel={label}
          secureTextEntry={hidden}
          placeholderTextColor={theme.textSecondary}
          selectionColor={theme.accent}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          style={s.input}
        />
        {secure ? (
          <PressableScale
            silent
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            onPress={() => setHidden((h) => !h)}
            hitSlop={8}
            style={s.toggle}
          >
            <Text style={s.toggleText}>{hidden ? 'Show' : 'Hide'}</Text>
          </PressableScale>
        ) : null}
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={s.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    group: { gap: SPACING.sm },
    label: { fontSize: 14, fontWeight: '600', color: t.textSecondary },
    inset: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: MIN_TOUCH + 4,
      borderRadius: RADII.md,
      backgroundColor: t.inset,
      borderWidth: 1.5,
      borderTopColor: t.insetEdgeDark,
      borderLeftColor: t.insetEdgeDark,
      borderBottomColor: t.insetEdgeLight,
      borderRightColor: t.insetEdgeLight,
      paddingHorizontal: SPACING.lg,
    },
    input: { flex: 1, fontSize: 16, color: t.text, paddingVertical: SPACING.md },
    toggle: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingLeft: SPACING.md },
    toggleText: { color: t.accent, fontWeight: '700', fontSize: 14 },
    error: { color: t.danger, fontSize: 14, lineHeight: 20 },
  });
