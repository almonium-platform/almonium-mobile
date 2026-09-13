import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans';
import { Literata_400Regular, Literata_600SemiBold } from '@expo-google-fonts/literata';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/src/auth-context';
import { ChatProvider } from '@/src/chat-client';
import { CrestProvider } from '@/src/crest-context';
import { UiLocaleProvider, useUiLocale } from '@/src/i18n-context';
import { persistOptions, queryClient } from '@/src/query-client';
import { NoticeProvider } from '@/src/notice-context';
import { ThemeProvider, useTheme } from '@/src/theme';

void SplashScreen.preventAutoHideAsync();
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export default function RootLayout() {
  return (
    <UiLocaleProvider>
      <ThemeProvider>
        <ThemedRootLayout />
      </ThemeProvider>
    </UiLocaleProvider>
  );
}

function ThemedRootLayout() {
  const { colors, isDark, ready } = useTheme();
  const { ready: localeReady } = useUiLocale();
  const { t } = useTranslation();
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    Literata_400Regular,
    Literata_600SemiBold,
  });

  useEffect(() => {
    if (ready && localeReady && (fontsLoaded || fontError)) void SplashScreen.hideAsync();
  }, [fontError, fontsLoaded, localeReady, ready]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data.url;
      if (url === '/review') router.push('/review');
    });
    return () => subscription.remove();
  }, []);

  if (!ready || !localeReady || (!fontsLoaded && !fontError)) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
          <AuthProvider>
            <CrestProvider>
            <ChatProvider>
              <NoticeProvider>
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
                  <Stack.Screen name="book/[bookId]" options={{ title: t('Book') }} />
                  <Stack.Screen
                    name="reader/[bookId]"
                    options={{ title: t('Reader'), headerBackTitle: t('Library') }}
                  />
                  <Stack.Screen name="item/new" options={{ title: t('New learning item') }} />
                  <Stack.Screen name="item/[itemId]" options={{ title: t('Learning item') }} />
                  <Stack.Screen name="card/new" options={{ title: t('New learning item') }} />
                  <Stack.Screen name="card/[cardId]" options={{ title: t('Learning item') }} />
                  <Stack.Screen name="review" options={{ headerShown: false }} />
                  <Stack.Screen name="profile/[userId]" options={{ headerShown: false }} />
                  <Stack.Screen name="language/[code]" options={{ headerShown: false }} />
                  <Stack.Screen name="membership" options={{ headerShown: false }} />
                  <Stack.Screen name="c/[id]" options={{ headerShown: false }} />
                  <Stack.Screen name="d/[id]" options={{ headerShown: false }} />
                  <Stack.Screen name="chat/index" options={{ headerShown: false }} />
                  <Stack.Screen name="chat/[type]/[id]" options={{ headerShown: false }} />
                </Stack>
                <StatusBar style={isDark ? 'light' : 'dark'} />
              </NoticeProvider>
            </ChatProvider>
            </CrestProvider>
          </AuthProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
