import { Link } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Field, Title } from '@/components/ui';
import { useAuth } from '@/src/auth-context';
import { useNotice } from '@/src/notice-context';
import { createThemedStyles } from '@/src/theme';

export default function ForgotPasswordScreen() {
  const styles = useStyles();
  const { resetPassword } = useAuth();
  const showNotice = useNotice();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      await resetPassword(email);
      showNotice({ title: 'Email sent', message: 'Use the link in your inbox to choose a new password.', tone: 'success' });
    } catch (error) {
      showNotice({ title: 'Could not send email', message: error instanceof Error ? error.message : 'Try again.', tone: 'error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen contentStyle={styles.content}>
      <Title>Reset password</Title>
      <Text style={styles.subtitle}>Firebase will send a secure reset link to your email.</Text>
      <Card>
        <Field
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          keyboardType="email-address"
          autoComplete="email"
        />
        <Button loading={loading} disabled={!email.trim()} onPress={submit}>
          Send reset link
        </Button>
      </Card>
      <Link href="/(auth)/sign-in" style={styles.link}>
        Back to sign in
      </Link>
    </Screen>
  );
}

const useStyles = createThemedStyles((colors) => ({
  content: { flexGrow: 1, justifyContent: 'center' },
  subtitle: { fontSize: 17, lineHeight: 25, color: colors.muted },
  link: { color: colors.primary, textAlign: 'center', fontWeight: '600' },
}));
