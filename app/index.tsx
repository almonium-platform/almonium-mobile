import { Redirect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { useAuth } from '@/src/auth-context';
import { safeReturnPath } from '@/src/guest';
import { authenticatedDestination } from '@/src/navigation';
import { createThemedStyles, useTheme } from '@/src/theme';

export default function Index() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useStyles();
  const { firebaseUser, profile, profileError, retryProfile, logOut, loading } = useAuth();
  // A guest who signed in from a book goes back to it, once the account is ready to read.
  const returnTo = safeReturnPath(useLocalSearchParams<{ returnTo?: string }>().returnTo);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (firebaseUser && profileError) {
    return (
      <View style={styles.recovery}>
        <Text style={styles.title}>{t('We could not reach your Almonium profile.')}</Text>
        <Text style={styles.message}>{profileError}</Text>
        <Button onPress={retryProfile}>{t('Try again')}</Button>
        <Button variant="secondary" onPress={logOut}>
          {t('Sign out')}
        </Button>
      </View>
    );
  }

  // The library is the front door: a cold open without a session reads, and sign-in is a sheet on demand.
  if (!firebaseUser) return <Redirect href="/read" />;
  const destination = authenticatedDestination(Boolean(firebaseUser), Boolean(profile), profile?.setupStep);
  return <Redirect href={returnTo && destination === '/(tabs)/home' ? (returnTo as never) : destination} />;
}

const useStyles = createThemedStyles((colors) => ({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  recovery: { flex: 1, justifyContent: 'center', gap: 14, padding: 28, backgroundColor: colors.canvas },
  title: { color: colors.ink, fontSize: 24, lineHeight: 30, fontWeight: '600', textAlign: 'center' },
  message: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
}));
