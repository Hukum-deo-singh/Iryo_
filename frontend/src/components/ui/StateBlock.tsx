import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useStyles, useTheme } from '@/context/PrefsContext';
import { SPACING, type Theme } from '@/theme/tokens';

import { Button } from './Button';
import { Card } from './Card';
import { Icon, type IconName } from './Icon';

interface Props {
  icon?: IconName;
  /** Replaces the icon, for example with a character. */
  art?: React.ReactNode;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** One calm layout for empty, error and success moments. */
export function StateBlock({ icon, art, title, message, actionLabel, onAction }: Props) {
  const s = useStyles(makeStyles);
  const theme = useTheme();
  return (
    <Animated.View entering={FadeInDown.duration(380)}>
      <Card>
        <View style={s.body}>
          {art ??
            (icon ? (
              <View style={s.badge}>
                <Icon name={icon} color={theme.accent} size={26} />
              </View>
            ) : null)}
          <Text accessibilityRole="header" style={s.title}>
            {title}
          </Text>
          <Text style={s.message}>{message}</Text>
          {actionLabel && onAction ? (
            <View style={s.action}>
              <Button title={actionLabel} onPress={onAction} />
            </View>
          ) : null}
        </View>
      </Card>
    </Animated.View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    body: { alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.md },
    badge: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.inset,
      borderWidth: 1.5,
      borderTopColor: t.insetEdgeDark,
      borderLeftColor: t.insetEdgeDark,
      borderBottomColor: t.insetEdgeLight,
      borderRightColor: t.insetEdgeLight,
    },
    title: { fontSize: 20, fontWeight: '700', color: t.text, textAlign: 'center' },
    message: { fontSize: 15, lineHeight: 22, color: t.textSecondary, textAlign: 'center' },
    action: { alignSelf: 'stretch', marginTop: SPACING.sm },
  });
