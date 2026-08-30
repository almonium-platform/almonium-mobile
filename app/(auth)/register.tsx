import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Field, Title } from '@/components/ui';
import { useAuth } from '@/src/auth-context';
import { useNotice } from '@/src/notice-context';
import { colors } from '@/src/theme';

export default function RegisterScreen() {
  const { register } = useAuth();
  const showNotice = useNotice();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      await register(email, password);
      router.replace('/(auth)/sign-in');
      showNotice({ title: 'Check your inbox', message: 'Verify your email, then return here to sign in.', tone: 'success' });
    } catch (error) {
      showNotice({ title: 'Could not create account', message: error instanceof Error ? error.message : 'Try again.', tone: 'error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen contentStyle={styles.content}>
      <Title>Start your shelf.</Title>
      <Text style={styles.subtitle}>Create an account, verify your email, and choose your language.</Text>
      <Card>
        <Field
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          keyboardType="email-address"
          autoComplete="email"
        />
        <Field
          value={password}
          onChangeText={setPassword}
          placeholder="Password (8+ characters)"
          secureTextEntry
          autoComplete="new-password"
        />
        <Button
          loading={loading}
          disabled={!email.trim() || password.length < 8}
          onPress={submit}>
          Create account
        </Button>
      </Card>
      <Link href="/(auth)/sign-in" style={styles.link}>
        Back to sign in
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center' },
  subtitle: { fontSize: 17, lineHeight: 25, color: colors.muted },
  link: { color: colors.primary, textAlign: 'center', fontWeight: '600' },
});
