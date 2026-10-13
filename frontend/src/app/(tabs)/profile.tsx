import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AVATAR_PRESETS } from '@/art/svgs';
import { Avatar } from '@/components/art/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { PressableScale } from '@/components/ui/PressableScale';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { useAuth } from '@/context/AuthContext';
import { usePrefs, useStyles, useTheme } from '@/context/PrefsContext';
import { fx } from '@/services/feedback';
import { ACCENTS, TONES, SPACING, type AccentId, type ModePref, type Theme, type ToneId } from '@/theme/tokens';

const MODES: { value: ModePref; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function ProfileScreen() {
  const s = useStyles(makeStyles);
  const theme = useTheme();
  const { prefs, setPrefs } = usePrefs();
  const { user, logout } = useAuth();
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    await logout();
  };

  return (
    <Screen>
      <Animated.View entering={FadeInDown.duration(400)} style={s.hero}>
        <View style={s.avatarRing}>
          <Avatar presetId={prefs.avatar} size={132} />
        </View>
        <Text style={s.name}>{user?.displayName ?? ''}</Text>
        <Text style={s.email}>{user?.email ?? ''}</Text>
        <View style={s.chip} accessible accessibilityLabel={`User ID ${user?.userId ?? ''}`}>
          <Text style={s.chipText}>{user?.userId ?? ''}</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(80).duration(450)}>
        <Card>
          <Text style={s.section}>Character</Text>
          <View style={s.row}>
            {AVATAR_PRESETS.map((preset) => {
              const selected = preset.id === prefs.avatar;
              return (
                <PressableScale
                  key={preset.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${preset.label} character`}
                  accessibilityState={{ selected }}
                  onPress={() => setPrefs({ avatar: preset.id })}
                  style={[s.thumb, selected && { borderColor: theme.accent, borderWidth: 2.5 }]}
                >
                  <Avatar presetId={preset.id} size={58} still />
                </PressableScale>
              );
            })}
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(140).duration(450)}>
        <Card>
          <View style={s.stack}>
            <Text style={s.section}>Appearance</Text>
            <Segmented options={MODES} value={prefs.mode} onChange={(mode) => setPrefs({ mode })} />

            <Text style={s.label}>Background</Text>
            <View style={s.row}>
              {(Object.keys(TONES) as ToneId[]).map((id) => (
                <Swatch
                  key={id}
                  label={TONES[id].label}
                  color={theme.isDark ? TONES[id].dark.surfaceHi : TONES[id].swatch}
                  selected={prefs.tone === id}
                  onPress={() => setPrefs({ tone: id })}
                />
              ))}
            </View>

            <Text style={s.label}>Accent colour</Text>
            <View style={s.row}>
              {(Object.keys(ACCENTS) as AccentId[]).map((id) => (
                <Swatch
                  key={id}
                  label={ACCENTS[id].label}
                  color={ACCENTS[id].swatch}
                  selected={prefs.accent === id}
                  onPress={() => setPrefs({ accent: id })}
                />
              ))}
            </View>
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(450)}>
        <Card>
          <Text style={s.section}>Experience</Text>
          <ToggleRow label="Sound effects" hint="Clicks, chimes and the door" value={prefs.sound} onChange={(sound) => setPrefs({ sound })} />
          <ToggleRow label="Haptics" hint="Light vibration on taps" value={prefs.haptics} onChange={(haptics) => setPrefs({ haptics })} />
          <ToggleRow label="Animations" hint="Turn off for a calmer, faster app" value={prefs.motion} onChange={(motion) => setPrefs({ motion })} />
          <Text style={s.note}>These settings stay on this phone only.</Text>
        </Card>
      </Animated.View>

      <Button title="Sign out" variant="secondary" onPress={signOut} loading={busy} />
    </Screen>
  );
}

function Swatch({ label, color, selected, onPress }: { label: string; color: string; selected: boolean; onPress: () => void }) {
  const s = useStyles(makeStyles);
  const theme = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={() => {
        fx.pop();
        onPress();
      }}
      silent
      style={s.swatchWrap}
    >
      <View style={[s.swatch, { backgroundColor: color }, selected && { borderColor: theme.accent, borderWidth: 3 }]} />
      <Text style={s.swatchLabel}>{label}</Text>
    </PressableScale>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    hero: { alignItems: 'center', gap: SPACING.xs, marginTop: SPACING.sm },
    avatarRing: { width: 150, height: 150, borderRadius: 75, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: t.inset, borderWidth: 3, borderColor: t.accent, marginBottom: SPACING.sm },
    name: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4, color: t.text },
    email: { fontSize: 14, color: t.textSecondary },
    chip: { marginTop: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: 4, borderRadius: 999, backgroundColor: t.inset },
    chipText: { fontSize: 13, fontWeight: '700', color: t.textSecondary, letterSpacing: 0.6 },
    section: { fontSize: 18, fontWeight: '700', color: t.text, marginBottom: SPACING.sm },
    label: { fontSize: 14, fontWeight: '600', color: t.textSecondary },
    stack: { gap: SPACING.md },
    row: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.sm },
    thumb: { width: 66, height: 66, borderRadius: 33, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: t.inset, borderWidth: 1, borderColor: t.border },
    swatchWrap: { alignItems: 'center', gap: 6, flex: 1 },
    swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: t.border },
    swatchLabel: { fontSize: 12, color: t.textSecondary },
    note: { fontSize: 13, color: t.textSecondary, marginTop: SPACING.sm },
  });
