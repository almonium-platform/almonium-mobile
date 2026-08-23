import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/src/auth-context';
import { persistOptions, queryClient } from '@/src/query-client';
import { colors } from '@/src/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
          <AuthProvider>
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: colors.canvas },
                headerShadowVisible: false,
                headerTintColor: colors.ink,
                contentStyle: { backgroundColor: colors.canvas },
              }}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="onboarding" options={{ headerShown: false }} />
              <Stack.Screen name="book/[bookId]" options={{ title: 'Book' }} />
              <Stack.Screen
                name="reader/[bookId]"
                options={{ title: 'Reader', headerBackTitle: 'Library' }}
              />
              <Stack.Screen name="card/new" options={{ title: 'New card' }} />
              <Stack.Screen name="card/[cardId]" options={{ title: 'Card' }} />
              <Stack.Screen name="review" options={{ headerShown: false }} />
              <Stack.Screen name="profile/[userId]" options={{ title: 'Reader profile' }} />
              <Stack.Screen name="membership" options={{ title: 'Membership' }} />
            </Stack>
            <StatusBar style="dark" />
          </AuthProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
