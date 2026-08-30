import { LinearGradient } from 'expo-linear-gradient';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { BrandMark } from '@/components/brand-mark';
import { Button, Card, Field, Title } from '@/components/ui';
import { isExpoGo, useAuth } from '@/src/auth-context';
import { useNotice } from '@/src/notice-context';
import { colors, gradients } from '@/src/theme';

export default function SignInScreen() {
  const { signIn, signInWithGoogle, signInWithApple } = useAuth();
  const showNotice = useNotice();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') {
      void AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
    }
  }, []);

  async function submit() {
    setLoading(true);
    try {
      await signIn(email, password);
      router.replace('/');
    } catch (error) {
      showNotice({ title: 'Could not sign in', message: error instanceof Error ? error.message : 'Please try again.', tone: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function appleSignIn() {
    setLoading(true);
    try {
      await signInWithApple();
      router.replace('/');
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as Error & { code: string }).code === 'ERR_REQUEST_CANCELED'
      ) {
        return;
      }
      showNotice({ title: 'Could not sign in with Apple', message: error instanceof Error ? error.message : 'Try again.', tone: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function googleSignIn() {
    setLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/');
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        (error as Error & { code: string }).code === 'ERR_REQUEST_CANCELED'
      ) {
        return;
      }
      showNotice({ title: 'Could not sign in with Google', message: error instanceof Error ? error.message : 'Try again.', tone: 'error' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient colors={gradients.auth} style={styles.background}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <View style={styles.brand}>
          <BrandMark />
          <Title>Read beyond{'\n'}your vocabulary.</Title>
          <Text style={styles.subtitle}>
            Books that grow with your language, one page at a time.
          </Text>
        </View>

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
            placeholder="Password"
            secureTextEntry
            autoComplete="current-password"
          />
          <Button
            loading={loading}
            disabled={!email.trim() || password.length < 8}
            onPress={submit}>
            Sign in
          </Button>
          {Platform.OS !== 'web' && !isExpoGo && (
            <Button variant="secondary" disabled={loading} onPress={googleSignIn}>
              Continue with Google
            </Button>
          )}
          {isExpoGo && (
            <Text style={styles.expoGoHint}>
              Google sign-in is available in the development build. Use email and password in Expo Go.
            </Text>
          )}
          {appleAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={27}
              style={styles.appleButton}
              onPress={appleSignIn}
            />
          )}
          <View style={styles.links}>
            <Link href="/(auth)/forgot-password" style={styles.link}>
              Forgot password?
            </Link>
            <Link href="/(auth)/register" style={styles.link}>
              Create account
            </Link>
          </View>
        </Card>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 26 },
  brand: { gap: 12 },
  subtitle: { color: colors.muted, fontSize: 17, lineHeight: 25, maxWidth: 330 },
  links: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 2 },
  link: { color: colors.primary, fontWeight: '600' },
  expoGoHint: { color: colors.muted, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  appleButton: { height: 52, width: '100%' },
});
