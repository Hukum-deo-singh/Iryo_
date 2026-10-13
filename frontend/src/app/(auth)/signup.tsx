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
import { validateEmail, validateName, validatePassword } from '@/utils/validation';

interface FieldErrors {
  name?: string | null;
  email?: string | null;
  password?: string | null;
}

export default function SignupScreen() {
  const s = useStyles(makeStyles);
  const { signup } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const next: FieldErrors = { name: validateName(name), email: validateEmail(email), password: validatePassword(password) };
    setErrors(next);
    setFormError(null);
    if (next.name || next.email || next.password) {
      fx.error();
      return;
    }
    setBusy(true);
    try {
      await signup({ displayName: name, email, password });
      fx.success();
    } catch (error) {
      fx.error();
      setFormError(
        error instanceof ApiError && error.status === 409
          ? 'An account with this email already exists. Try signing in.'
          : error instanceof ApiError
            ? error.message
            : 'We couldn’t create your account. Please try again.',
      );
      setBusy(false);
    }
  };

  return (
    <AuthIntroGate kind="signup" title="Join Iryo">
      <Screen>
        <Animated.View entering={FadeInDown.duration(450)} style={s.header}>
          <Text style={s.title}>Create your account</Text>
          <Text style={s.subtitle}>Your readings stay private to your account.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(450)}>
          <Card>
            <View style={s.form}>
              <Field
                label="Full name"
                value={name}
                onChangeText={setName}
                error={errors.name}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
              />
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
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="done"
                onSubmitEditing={submit}
              />
              <Text style={s.subtitle}>At least 8 characters, with a letter and a number.</Text>
              {formError ? (
                <Text accessibilityLiveRegion="polite" style={s.formError}>
                  {formError}
                </Text>
              ) : null}
              <Button title="Create account" onPress={submit} loading={busy} />
            </View>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(240).duration(450)} style={s.footer}>
          <Text style={s.subtitle}>Already have an account?</Text>
          <Link href="/login" accessibilityRole="link" style={s.link}>
            Sign in
          </Link>
        </Animated.View>
      </Screen>
    </AuthIntroGate>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    header: { gap: SPACING.sm, marginTop: SPACING.xl },
    title: { fontSize: 32, fontWeight: '800', letterSpacing: -0.6, color: t.text },
    subtitle: { fontSize: 15, color: t.textSecondary },
    form: { gap: SPACING.lg },
    formError: { color: t.danger, fontSize: 14, lineHeight: 20 },
    footer: { alignItems: 'center', gap: SPACING.xs },
    link: { color: t.accent, fontSize: 16, fontWeight: '700', paddingVertical: SPACING.md },
  });
