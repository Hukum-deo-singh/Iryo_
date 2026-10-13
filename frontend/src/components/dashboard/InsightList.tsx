import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Card } from '@/components/ui/Card';
import { useStyles, useTheme } from '@/context/PrefsContext';
import { RADII, SPACING, type Theme } from '@/theme/tokens';
import type { DerivedIndicator, IndicatorLevel } from '@/types/api';

const LABEL: Record<IndicatorLevel, string> = {
  normal: 'Within range',
  attention: 'Needs attention',
  urgent: 'Seek advice',
  info: 'Info',
};

/** The level is always written out in words, never shown by colour alone. */
export function InsightList({ items }: { items: DerivedIndicator[] }) {
  const s = useStyles(makeStyles);
  const theme = useTheme();
  if (items.length === 0) return null;
  const color: Record<IndicatorLevel, string> = {
    normal: theme.success,
    attention: theme.warning,
    urgent: theme.danger,
    info: theme.textSecondary,
  };

  return (
    <Animated.View entering={FadeInDown.delay(120).duration(420)}>
      <Card>
        <Text accessibilityRole="header" style={s.heading}>
          Insights
        </Text>
        {items.map((item, i) => {
          const c = color[item.level] ?? theme.textSecondary;
          const text = LABEL[item.level] ?? LABEL.info;
          return (
            <View key={item.key} style={[s.row, i > 0 && s.divider]} accessible accessibilityLabel={`${item.label}: ${item.value}. ${text}.`}>
              <View style={s.top}>
                <Text style={s.label}>{item.label}</Text>
                <View style={[s.pill, { borderColor: c }]}>
                  <Text style={[s.pillText, { color: c }]}>{text}</Text>
                </View>
              </View>
              <Text style={s.value}>{item.value}</Text>
              {item.note ? <Text style={s.note}>{item.note}</Text> : null}
            </View>
          );
        })}
      </Card>
    </Animated.View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    heading: { fontSize: 18, fontWeight: '700', color: t.text, marginBottom: SPACING.sm },
    row: { gap: SPACING.xs, paddingVertical: SPACING.md },
    divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
    top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SPACING.sm },
    label: { fontSize: 14, fontWeight: '600', color: t.textSecondary, flexShrink: 1 },
    pill: { borderWidth: 1.5, borderRadius: RADII.round, paddingHorizontal: SPACING.md, paddingVertical: 3 },
    pillText: { fontSize: 12, fontWeight: '700' },
    value: { fontSize: 16, color: t.text },
    note: { fontSize: 14, lineHeight: 20, color: t.textSecondary },
  });
