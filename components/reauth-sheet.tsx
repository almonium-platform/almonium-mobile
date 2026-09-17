import { Platform, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Sheet } from '@/components/sheet';
import { Button, Field } from '@/components/ui';
import { useAuth } from '@/src/auth-context';
import { createThemedStyles, fonts, serifLineHeight } from '@/src/theme';

interface Consequence {
  label: string;
  value: string;
}

/**
 * The guard is not sign-in. Two gates, two steps, never one box: step one proves intent
 * (consequences, typed name), step two proves identity (password, or a fresh provider
 * challenge). The commit button names the action, and Cancel is worded as the safe outcome.
 * Surfaces that only need identity — changing an email, disconnecting a provider — skip the
 * consequence panel and take the plum button.
 *
 * One primary action per step, full width, and the way out is a text button beneath it: at
 * phone width two pills side by side wrap the safe word onto two lines next to a dead button.
 * The typed gate's placeholder never repeats the answer.
 */
export function ReauthSheet({
  visible,
  onClose,
  onConfirmed,
  title,
  description,
  actionLabel,
  destructive = false,
  consequences,
  typedGate,
}: {
  visible: boolean;
  onClose(): void;
  onConfirmed(): Promise<void>;
  title: string;
  description: string;
  actionLabel: string;
  destructive?: boolean;
  consequences?: Consequence[];
  /** The word to type before step two: the username on account deletion. */
  typedGate?: string;
}) {
  const { t } = useTranslation();
  const safeWord = destructive ? t('Keep my account') : t('Cancel');
  const styles = useStyles();
  const { firebaseUser, reauthenticateWithPassword, reauthenticateWithGoogle, reauthenticateWithApple } = useAuth();
  const [step, setStep] = useState<'intent' | 'identity'>(typedGate || consequences ? 'intent' : 'identity');
  const [typed, setTyped] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const usesPassword = firebaseUser?.providerData.some((provider) => provider.providerId === 'password');
  const usesGoogle = firebaseUser?.providerData.some((provider) => provider.providerId === 'google.com');
  const usesApple = firebaseUser?.providerData.some((provider) => provider.providerId === 'apple.com');

  useEffect(() => {
    if (!visible) return;
    setStep(typedGate || consequences ? 'intent' : 'identity');
    setTyped('');
    setPassword('');
    setError('');
  }, [consequences, typedGate, visible]);

  async function confirm() {
    setBusy(true);
    setError('');
    try {
      if (usesPassword) await reauthenticateWithPassword(password);
      else if (usesGoogle) await reauthenticateWithGoogle();
      else if (usesApple) await reauthenticateWithApple();
      await onConfirmed();
      onClose();
    } catch (cause) {
      // Wrong password is an inline field error, not a toast: the typed name and the pending action survive.
      setError(cause instanceof Error ? cause.message : t('That did not go through. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  const method = usesPassword ? 'password' : usesGoogle ? 'Google' : usesApple ? 'Apple' : null;
  const email = firebaseUser?.email ?? t('this account');

  return (
    <Sheet visible={visible} onClose={onClose}>
      {step === 'intent' ? (
        <>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.copy}>{description}</Text>
          {!!consequences?.length && (
            <View style={styles.consequences}>
              {consequences.map((item) => (
                <View key={item.label} style={styles.consequence}>
                  <Text style={styles.consequenceLabel}>{item.label}</Text>
                  <Text style={styles.consequenceValue}>{item.value}</Text>
                </View>
              ))}
            </View>
          )}
          {!!typedGate && (
            <View style={styles.gate}>
              <Text style={styles.label}>{t('Type {name} to confirm', { name: typedGate })}</Text>
              <Field value={typed} onChangeText={setTyped} placeholder={t('Username')} autoCorrect={false} />
            </View>
          )}
          <View style={styles.actions}>
            <Button
              variant={destructive ? 'destructive' : 'primary'}
              disabled={Boolean(typedGate) && typed.trim() !== typedGate}
              onPress={() => setStep('identity')}>
              {actionLabel}
            </Button>
            <Button variant="text" onPress={onClose}>{safeWord}</Button>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.title}>{t('Confirm it’s you')}</Text>
          <Text style={styles.copy}>
            {method === 'password'
              ? destructive
                ? t('Deleting an account is permanent, so we ask for your password once more. You are signed in as {email}.', { email })
                : t('This is a sensitive change, so we ask for your password once more. You are signed in as {email}.', { email })
              : method
                ? Platform.OS === 'ios'
                  ? t('Your account signs in with {method}, so {method} will ask you to confirm again in a sheet.', { method })
                  : t('Your account signs in with {method}, so {method} will ask you to confirm again.', { method })
                : t('Sign out and back in with your provider, then try again.')}
          </Text>
          {method === 'password' && (
            <View style={styles.gate}>
              <Text style={styles.label}>{t('Password')}</Text>
              <Field
                value={password}
                onChangeText={setPassword}
                placeholder={t('Password')}
                secureTextEntry
                textContentType="password"
                autoComplete="current-password"
                autoFocus
              />
            </View>
          )}
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <View style={styles.actions}>
            <Button
              variant={destructive ? 'destructive' : 'primary'}
              loading={busy}
              disabled={!method || (method === 'password' && !password)}
              onPress={() => void confirm()}>
              {actionLabel}
            </Button>
            <Button variant="text" disabled={busy} onPress={onClose}>{safeWord}</Button>
          </View>
        </>
      )}
    </Sheet>
  );
}

const useStyles = createThemedStyles((colors) => ({
  title: { color: colors.ink, fontFamily: fonts.serif, fontSize: 24, lineHeight: serifLineHeight(24) },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  consequences: { borderRadius: 16, backgroundColor: colors.nested, paddingHorizontal: 14 },
  consequence: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: colors.line },
  consequenceLabel: { color: colors.muted, fontSize: 14 },
  consequenceValue: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  gate: { gap: 7 },
  label: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
  actions: { gap: 6, paddingTop: 4 },
}));
