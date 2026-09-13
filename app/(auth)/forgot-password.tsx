import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';

import { Screen } from '@/components/screen';
import { Button, Card, Field, Title } from '@/components/ui';
import { useAuth } from '@/src/auth-context';
import { useNotice } from '@/src/notice-context';
import { createThemedStyles } from '@/src/theme';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const styles = useStyles();
  const { resetPassword } = useAuth();
  const showNotice = useNotice();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      await resetPassword(email);
      showNotice({ title: t('Email sent'), message: t('Use the link in your inbox to choose a new password.'), tone: 'success' });
    } catch (error) {
      showNotice({ title: t('Could not send email'), message: error instanceof Error ? error.message : t('Try again.'), tone: 'error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen contentStyle={styles.content}>
      <Title>{t('Reset password')}</Title>
      <Text style={styles.subtitle}>{t('Firebase will send a secure reset link to your email.')}</Text>
      <Card>
        <Field
          value={email}
          onChangeText={setEmail}
          placeholder={t('Email')}
          keyboardType="email-address"
          autoComplete="email"
        />
        <Button loading={loading} disabled={!email.trim()} onPress={submit}>
          {t('Send reset link')}
        </Button>
      </Card>
      <Link href="/(auth)/sign-in" style={styles.link}>
        {t('Back to sign in')}
      </Link>
    </Screen>
  );
}

const useStyles = createThemedStyles((colors) => ({
  content: { flexGrow: 1, justifyContent: 'center' },
  subtitle: { fontSize: 17, lineHeight: 25, color: colors.muted },
  link: { color: colors.primary, textAlign: 'center', fontWeight: '600' },
}));
