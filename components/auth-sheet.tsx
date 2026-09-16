import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Linking, Platform, Text, View } from 'react-native';

import { Sheet } from '@/components/sheet';
import { Button, Field } from '@/components/ui';
import { isExpoGo, useAuth } from '@/src/auth-context';
import { config } from '@/src/config';
import { languageName } from '@/src/languages';
import { useNotice } from '@/src/notice-context';
import { createThemedStyles, fonts, serifLineHeight, useTheme } from '@/src/theme';

/** Why the sheet opened: it always says so in one line, so the form is never a wall between the reader and the book. */
export type AuthReason =
  | { kind: 'save'; word: string; book: string }
  | { kind: 'place'; book: string }
  | { kind: 'translation'; book: string; language: string }
  | { kind: 'signin' }
  | { kind: 'start' };

/**
 * Sign-in as a sheet over the current screen: Apple and Google above, then email and password.
 * The reader stays behind it, dimmed, and gets the result back as a completed action. The one
 * email field the design asks for waits on an exists-check endpoint; until then the two modes
 * live inside the same sheet as a single toggle line.
 */
export function AuthSheet({ reason, onClose, onSignedIn }: { reason: AuthReason | null; onClose(): void; onSignedIn(): void }) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const styles = useStyles();
  const { signIn, register, signInWithGoogle, signInWithApple } = useAuth();
  const showNotice = useNotice();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'ios') void AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  useEffect(() => {
    if (reason) { setCreating(reason.kind !== 'signin'); setPassword(''); }
  }, [reason]);

  async function run(action: () => Promise<void>, failure: string) {
    setLoading(true);
    try {
      await action();
      onSignedIn();
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as Error & { code: string }).code === 'ERR_REQUEST_CANCELED') return;
      showNotice({ title: failure, message: error instanceof Error ? error.message : t('Please try again.'), tone: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (!creating) return run(() => signIn(email, password), t('Could not sign in'));
    setLoading(true);
    try {
      await register(email, password);
      setCreating(false);
      showNotice({ title: t('Check your inbox'), message: t('Verify your email, then sign in here to keep going.'), tone: 'success' });
    } catch (error) {
      showNotice({ title: t('Could not create account'), message: error instanceof Error ? error.message : t('Try again.'), tone: 'error' });
    } finally {
      setLoading(false);
    }
  }

  const title = reasonTitle(reason, t);
  return (
    <Sheet visible={Boolean(reason)} onClose={onClose}>
      <Text style={styles.eyebrow}>{creating ? t('FREE ACCOUNT') : t('SIGN IN')}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{t('100 words and every book, on any device. No card.')}</Text>
      <View style={styles.providers}>
        {appleAvailable && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={isDark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={27}
            style={styles.appleButton}
            onPress={() => void run(signInWithApple, t('Could not sign in with Apple'))}
          />
        )}
        {Platform.OS !== 'web' && !isExpoGo && (
          <Button variant="secondary" disabled={loading} onPress={() => void run(signInWithGoogle, t('Could not sign in with Google'))}>
            {t('Continue with Google')}
          </Button>
        )}
      </View>
      <View style={styles.divider}>
        <View style={styles.rule} /><Text style={styles.or}>{t('or')}</Text><View style={styles.rule} />
      </View>
      <Field value={email} onChangeText={setEmail} placeholder={t('Email')} keyboardType="email-address" autoComplete="email" />
      <Field
        value={password}
        onChangeText={setPassword}
        placeholder={creating ? t('Password (8+ characters)') : t('Password')}
        secureTextEntry
        autoComplete={creating ? 'new-password' : 'current-password'}
      />
      <Button loading={loading} disabled={!email.trim() || password.length < 8} onPress={() => void submit()}>
        {t('Continue')}
      </Button>
      <Text style={styles.toggle}>
        {creating ? t('Have an account?') : t('New here?')}{' '}
        <Text onPress={() => setCreating((value) => !value)} style={styles.toggleLink}>
          {creating ? t('Sign in') : t('Create a free account')}
        </Text>
      </Text>
      <Text style={styles.legal}>
        <Trans
          i18nKey="By continuing you agree to the <1>Terms</1> and <3>Privacy Policy</3>."
          components={{
            1: <Text onPress={() => void Linking.openURL(`${config.webBaseUrl}/terms-of-use`)} style={styles.legalLink} />,
            3: <Text onPress={() => void Linking.openURL(`${config.webBaseUrl}/privacy-policy`)} style={styles.legalLink} />,
          }}
        />
      </Text>
    </Sheet>
  );
}

function reasonTitle(reason: AuthReason | null, t: (key: string, values?: Record<string, string>) => string) {
  switch (reason?.kind) {
    case 'save': return t('Keep {word} and your place in {book}', { word: reason.word, book: reason.book });
    case 'place': return t('Keep your place in {book}', { book: reason.book });
    case 'translation': return t('Ask for {book} in {language}', { book: reason.book, language: languageName(reason.language) });
    case 'signin': return t('Welcome back');
    default: return t('Keep your place in every book');
  }
}

const useStyles = createThemedStyles((colors) => ({
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: '600', letterSpacing: 1.5 },
  title: { color: colors.ink, fontFamily: fonts.serif, fontSize: 26, lineHeight: serifLineHeight(26) },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  providers: { gap: 10, paddingTop: 6 },
  appleButton: { height: 54, width: '100%' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rule: { flex: 1, height: 1, backgroundColor: colors.line },
  or: { color: colors.metadata, fontSize: 12 },
  toggle: { color: colors.muted, fontSize: 13.5, textAlign: 'center' },
  toggleLink: { color: colors.primary, fontWeight: '600' },
  legal: { color: colors.metadata, fontSize: 12, lineHeight: 17, textAlign: 'center' },
  legalLink: { color: colors.primary },
}));
