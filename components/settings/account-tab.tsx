import { Ionicons } from '@expo/vector-icons';
import { useQueries } from '@tanstack/react-query';
import { router } from 'expo-router';
import { EmailAuthProvider, linkWithCredential, unlink, updatePassword } from 'firebase/auth';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Text, View } from 'react-native';

import { ReauthSheet } from '@/components/reauth-sheet';
import { ActionPill, Row, Section } from '@/components/settings/shared';
import { Sheet } from '@/components/sheet';
import { Button, Field } from '@/components/ui';
import { api } from '@/src/api';
import { appleFirebaseCredential, googleFirebaseCredential, useAuth } from '@/src/auth-context';
import { auth } from '@/src/firebase';
import { useNotice } from '@/src/notice-context';
import { createThemedStyles, fonts, serifLineHeight, useTheme } from '@/src/theme';

type Provider = 'google.com' | 'apple.com' | 'password';
type Pending = 'email' | 'password' | 'delete' | null;

function needsRecentLogin(error: unknown) {
  const code = (error as { code?: string } | null)?.code ?? '';
  const message = error instanceof Error ? error.message : '';
  return code === 'auth/requires-recent-login' || /recent/i.test(message) || /signed in with Firebase within/i.test(message);
}

/**
 * Every account action is a worded pill: Change, Connect, Disconnect, Set up, Delete. An email
 * is re-verified, not edited in place, and a password is replaced, not edited. Disconnect greys
 * out when it is the only method left; letting someone lock themselves out is the one real
 * failure available on this screen. Delete is one quiet line at the bottom; the guard does the
 * shouting.
 */
export function AccountTab() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles();
  const { firebaseUser, profile, logOut, refreshProfile } = useAuth();
  const showNotice = useNotice();
  const [busy, setBusy] = useState<string | null>(null);
  const [emailVisible, setEmailVisible] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [guard, setGuard] = useState<Pending>(null);
  const providers = firebaseUser?.providerData.map((provider) => provider.providerId) ?? [];
  const has = (provider: Provider) => providers.includes(provider);
  const onlyMethod = providers.length <= 1;
  const cardQueries = useQueries({
    queries: (profile?.learners ?? []).map((learner) => ({
      queryKey: ['cards', firebaseUser?.uid, learner.language],
      queryFn: () => api.cards(learner.language),
      enabled: Boolean(firebaseUser),
    })),
  });
  const savedWords = cardQueries.reduce((total, query) => total + (query.data?.length ?? 0), 0);

  async function run(key: string, action: () => Promise<void>, success?: string) {
    setBusy(key);
    try {
      await action();
      if (success) showNotice({ title: success, tone: 'success' });
    } catch (error) {
      if (needsRecentLogin(error) && (key === 'email' || key === 'password')) {
        setGuard(key);
        return;
      }
      showNotice({ title: t('That did not go through'), message: error instanceof Error ? error.message : t('Try again.'), tone: 'error' });
    } finally {
      setBusy(null);
    }
  }

  async function connect(provider: 'google.com' | 'apple.com') {
    const user = auth.currentUser;
    if (!user) return;
    const credential = provider === 'google.com' ? await googleFirebaseCredential() : await appleFirebaseCredential();
    await linkWithCredential(user, credential);
    await user.reload();
    await refreshProfile();
  }

  async function disconnect(provider: Provider) {
    const user = auth.currentUser;
    if (!user) return;
    await unlink(user, provider);
    await user.reload();
    await refreshProfile();
  }

  async function submitEmail() {
    await api.requestEmailChange(newEmail.trim());
    setEmailVisible(false);
    setNewEmail('');
  }

  async function submitPassword() {
    const user = auth.currentUser;
    if (!user?.email) throw new Error(t('This account has no email address to set a password on.'));
    if (has('password')) await updatePassword(user, newPassword);
    else await linkWithCredential(user, EmailAuthProvider.credential(user.email, newPassword));
    await user.reload();
    await refreshProfile();
    setPasswordVisible(false);
    setNewPassword('');
  }

  async function deleteAccount() {
    await api.deleteAccount();
    await logOut();
    router.replace('/(auth)/sign-in');
  }

  const providerRows: { id: 'google.com' | 'apple.com'; label: string; icon: 'logo-google' | 'logo-apple' }[] = [
    { id: 'google.com', label: 'Google', icon: 'logo-google' },
    { id: 'apple.com', label: 'Apple', icon: 'logo-apple' },
  ];

  return (
    <View style={styles.tab}>
      <Section eyebrow={t('EMAIL')}>
        <Row
          label={profile?.email ?? firebaseUser?.email ?? ''}
          detail={firebaseUser?.emailVerified ? t('✓ Verified') : t('Not verified')}>
          <ActionPill label={t('Change')} onPress={() => setEmailVisible(true)} />
        </Row>
      </Section>

      <Section eyebrow={t('HOW YOU SIGN IN')}>
        {providerRows.map((provider) => {
          const linked = has(provider.id);
          const unavailable = provider.id === 'apple.com' && Platform.OS !== 'ios' && !linked;
          if (unavailable) return null;
          return (
            <Row
              key={provider.id}
              icon={<View style={styles.methodIcon}><Ionicons name={provider.icon} size={17} color={colors.ink} /></View>}
              label={provider.label}
              detail={linked ? (firebaseUser?.providerData.find((entry) => entry.providerId === provider.id)?.email ?? t('Connected')) : t('Not connected')}
              note={linked && onlyMethod ? t('Your only sign-in method. Add another before disconnecting it.') : undefined}>
              <ActionPill
                label={linked ? t('Disconnect') : t('Connect')}
                disabled={linked && onlyMethod}
                busy={busy === provider.id}
                onPress={() =>
                  void run(
                    provider.id,
                    () => (linked ? disconnect(provider.id) : connect(provider.id)),
                    linked ? t('{provider} disconnected', { provider: provider.label }) : t('{provider} connected', { provider: provider.label }),
                  )
                }
              />
            </Row>
          );
        })}
        <Row
          icon={<View style={styles.methodIcon}><Ionicons name="mail-outline" size={17} color={colors.ink} /></View>}
          label={t('Password')}
          detail={has('password') ? t('Set') : t('Not set — adds a way back in if a connected account is lost')}>
          <ActionPill label={has('password') ? t('Change') : t('Set up')} onPress={() => setPasswordVisible(true)} />
        </Row>
      </Section>

      <View style={styles.deleteRow}>
        <Text style={styles.deleteLabel}>{t('Delete account and all data')}</Text>
        <ActionPill label={t('Delete')} tone="danger" onPress={() => setGuard('delete')} />
      </View>

      <Button variant="secondary" onPress={() => void logOut().then(() => router.replace('/(auth)/sign-in'))}>
        {t('Sign out')}
      </Button>

      <Sheet visible={emailVisible} onClose={() => setEmailVisible(false)}>
        <Text style={styles.sheetTitle}>{t('Change your email')}</Text>
        <Text style={styles.note}>{t('We send a verification link to the new address. Your sign-in changes once you open it.')}</Text>
        <Field value={newEmail} onChangeText={setNewEmail} placeholder={t('New email address')} keyboardType="email-address" autoComplete="email" autoFocus />
        <Button loading={busy === 'email'} disabled={!/^\S+@\S+\.\S+$/.test(newEmail.trim())} onPress={() => void run('email', submitEmail, t('Check the new inbox for the link'))}>
          {t('Send verification link')}
        </Button>
      </Sheet>

      <Sheet visible={passwordVisible} onClose={() => setPasswordVisible(false)}>
        <Text style={styles.sheetTitle}>{has('password') ? t('Change your password') : t('Set a password')}</Text>
        <Text style={styles.note}>
          {has('password')
            ? t('8 or more characters. The old one stops working straight away.')
            : t('8 or more characters. It signs you in alongside your connected account.')}
        </Text>
        <Field value={newPassword} onChangeText={setNewPassword} placeholder={t('New password')} secureTextEntry autoComplete="new-password" autoFocus />
        <Button loading={busy === 'password'} disabled={newPassword.length < 8} onPress={() => void run('password', submitPassword, has('password') ? t('Password changed') : t('Password set'))}>
          {has('password') ? t('Change password') : t('Set password')}
        </Button>
      </Sheet>

      <ReauthSheet
        visible={guard !== null}
        onClose={() => setGuard(null)}
        destructive={guard === 'delete'}
        title={guard === 'delete' ? t('Delete your account?') : t('Confirm it’s you')}
        description={
          guard === 'delete'
            ? t('This removes your account, your saved words and your reading progress. It cannot be undone and support cannot restore it.')
            : t('This is a sensitive change, so we ask once more before it goes through.')
        }
        actionLabel={guard === 'delete' ? t('Delete account') : guard === 'email' ? t('Change email') : t('Change password')}
        consequences={
          guard === 'delete'
            ? [
                { label: t('Saved words'), value: savedWords.toLocaleString() },
                { label: t('Languages'), value: String(profile?.learners.length ?? 0) },
              ]
            : undefined
        }
        typedGate={guard === 'delete' ? profile?.username : undefined}
        onConfirmed={guard === 'delete' ? deleteAccount : guard === 'email' ? submitEmail : submitPassword}
      />
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  tab: { gap: 18 },
  methodIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.nested },
  deleteRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 12 },
  deleteLabel: { color: colors.muted, fontSize: 14 },
  note: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  sheetTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 24, lineHeight: serifLineHeight(24) },
}));
