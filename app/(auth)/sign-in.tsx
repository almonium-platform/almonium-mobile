import { LinearGradient } from 'expo-linear-gradient';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Field, Title } from '@/components/ui';
import { useAuth } from '@/src/auth-context';
import { colors } from '@/src/theme';

export default function SignInScreen() {
  const { signIn, signInWithGoogle, signInWithApple } = useAuth();
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
      Alert.alert('Could not sign in', error instanceof Error ? error.message : 'Please try again.');
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
      Alert.alert('Could not sign in with Apple', error instanceof Error ? error.message : 'Try again.');
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
      Alert.alert('Could not sign in with Google', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient colors={['#eef5ec', colors.canvas, '#f7eedb']} style={styles.background}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <View style={styles.brand}>
          <Text style={styles.mark}>A</Text>
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
          {Platform.OS !== 'web' && (
            <GoogleSigninButton
              size={GoogleSigninButton.Size.Wide}
              color={GoogleSigninButton.Color.Light}
              disabled={loading}
              style={styles.googleButton}
              onPress={googleSignIn}
            />
          )}
          {appleAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={14}
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
  mark: {
    width: 46,
    height: 46,
    borderRadius: 14,
    overflow: 'hidden',
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 46,
    color: colors.white,
    backgroundColor: colors.primary,
    fontSize: 25,
    fontWeight: '900',
  },
  subtitle: { color: colors.muted, fontSize: 17, lineHeight: 25, maxWidth: 330 },
  links: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 2 },
  link: { color: colors.primary, fontWeight: '700' },
  googleButton: { height: 52, width: '100%' },
  appleButton: { height: 52, width: '100%' },
});
