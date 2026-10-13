import { StyleSheet, Switch, Text, View } from 'react-native';

import { useStyles, useTheme } from '@/context/PrefsContext';
import { fx } from '@/services/feedback';
import { MIN_TOUCH, SPACING, type Theme } from '@/theme/tokens';

interface Props {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (next: boolean) => void;
}

export function ToggleRow({ label, hint, value, onChange }: Props) {
  const s = useStyles(makeStyles);
  const theme = useTheme();
  return (
    <View style={s.row}>
      <View style={s.texts}>
        <Text style={s.label}>{label}</Text>
        {hint ? <Text style={s.hint}>{hint}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={(next) => {
          onChange(next);
          if (next) fx.toggle();
        }}
        trackColor={{ false: theme.inset, true: theme.accent }}
        thumbColor={theme.isDark ? '#F4F4F2' : '#FFFFFF'}
      />
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: MIN_TOUCH, gap: SPACING.md },
    texts: { flex: 1, gap: 2 },
    label: { fontSize: 16, fontWeight: '600', color: t.text },
    hint: { fontSize: 13, color: t.textSecondary },
  });
