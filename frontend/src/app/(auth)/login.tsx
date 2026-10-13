import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AuthIntroGate } from '@/components/art/AuthIntroGate';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Screen } from '@/components/ui/Screen';
import { useAuth } from '@/context/AuthContext';
import { useStyles } from '@/context/PrefsContext';
import { ApiError } from '@/services/apiClient';
import { fx } from '@/services/feedback';
import { SPACING, type Theme } from '@/theme/tokens';
import { validateEmail, validateLoginPassword } from '@/utils/validation';

export default function LoginScreen() {
  const s = useStyles(makeStyles);
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const next = { email: validateEmail(email), password: validateLoginPassword(password) };
    setErrors(next);
    setFormError(null);
    if (next.email || next.password) {
      fx.error();
      return;
    }
    setBusy(true);
    try {
      await login({ email, password });
      fx.success();
    } catch (error) {
      fx.error();
      setFormError(
        error instanceof ApiError && error.status === 401
          ? 'Email or password is incorrect.'
          : error instanceof ApiError
            ? error.message
            : 'We couldn’t sign you in. Please try again.',
      );
      setBusy(false);
    }
  };

  return (
    <AuthIntroGate kind="login" title="Welcome back">
      <Screen>
        <Animated.View entering={FadeInDown.duration(450)} style={s.header}>
          <Text style={s.title}>Welcome back</Text>
          <Text style={s.subtitle}>Sign in to see your latest readings.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(450)}>
          <Card>
            <View style={s.form}>
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                error={errors.email}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="next"
              />
              <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                error={errors.password}
                secure
                autoCapitalize="none"
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="done"
                onSubmitEditing={submit}
              />
              {formError ? (
                <Text accessibilityLiveRegion="polite" style={s.formError}>
                  {formError}
                </Text>
              ) : null}
              <Button title="Sign in" onPress={submit} loading={busy} />
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(240).duration(450)} style={s.footer}>
          <Text style={s.subtitle}>New to Iryo?</Text>
          <Link href="/signup" accessibilityRole="link" style={s.link}>
            Create an account
          </Link>
        </Animated.View>
      </Screen>
    </AuthIntroGate>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    header: { gap: SPACING.sm, marginTop: SPACING.xxl },
    title: { fontSize: 32, fontWeight: '800', letterSpacing: -0.6, color: t.text },
    subtitle: { fontSize: 15, color: t.textSecondary },
    form: { gap: SPACING.lg },
    formError: { color: t.danger, fontSize: 14, lineHeight: 20 },
    footer: { alignItems: 'center', gap: SPACING.xs },
    link: { color: t.accent, fontSize: 16, fontWeight: '700', paddingVertical: SPACING.md },
  });
