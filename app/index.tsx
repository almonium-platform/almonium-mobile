import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { useAuth } from '@/src/auth-context';
import { authenticatedDestination } from '@/src/navigation';
import { colors } from '@/src/theme';

export default function Index() {
  const { firebaseUser, profile, profileError, retryProfile, logOut, loading } = useAuth();

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
        <Text style={styles.title}>We could not reach your Almonium profile.</Text>
        <Text style={styles.message}>{profileError}</Text>
        <Button onPress={retryProfile}>Try again</Button>
        <Button variant="secondary" onPress={logOut}>
          Sign out
        </Button>
      </View>
    );
  }

  return (
    <Redirect
      href={authenticatedDestination(Boolean(firebaseUser), Boolean(profile), profile?.setupStep)}
    />
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  recovery: { flex: 1, justifyContent: 'center', gap: 14, padding: 28, backgroundColor: colors.canvas },
  title: { color: colors.ink, fontSize: 24, lineHeight: 30, fontWeight: '900', textAlign: 'center' },
  message: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
