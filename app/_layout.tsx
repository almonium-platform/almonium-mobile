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
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/src/auth-context';
import { ChatProvider } from '@/src/chat-client';
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
    <ThemeProvider>
      <ThemedRootLayout />
    </ThemeProvider>
  );
}

function ThemedRootLayout() {
  const { colors, isDark, ready } = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    Literata_400Regular,
    Literata_600SemiBold,
  });

  useEffect(() => {
    if (ready && (fontsLoaded || fontError)) void SplashScreen.hideAsync();
  }, [fontError, fontsLoaded, ready]);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const url = response.notification.request.content.data.url;
      if (url === '/review') router.push('/review');
    });
    return () => subscription.remove();
  }, []);

  if (!ready || (!fontsLoaded && !fontError)) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
          <AuthProvider>
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
                  <Stack.Screen name="book/[bookId]" options={{ title: 'Book' }} />
                  <Stack.Screen
                    name="reader/[bookId]"
                    options={{ title: 'Reader', headerBackTitle: 'Library' }}
                  />
                  <Stack.Screen name="item/new" options={{ title: 'New learning item' }} />
                  <Stack.Screen name="item/[itemId]" options={{ title: 'Learning item' }} />
                  <Stack.Screen name="card/new" options={{ title: 'New learning item' }} />
                  <Stack.Screen name="card/[cardId]" options={{ title: 'Learning item' }} />
                  <Stack.Screen name="review" options={{ headerShown: false }} />
                  <Stack.Screen name="profile/[userId]" options={{ title: 'Reader profile' }} />
                  <Stack.Screen name="membership" options={{ title: 'Membership' }} />
                  <Stack.Screen name="chat/index" options={{ headerShown: false }} />
                  <Stack.Screen name="chat/[type]/[id]" options={{ headerShown: false }} />
                </Stack>
                <StatusBar style={isDark ? 'light' : 'dark'} />
              </NoticeProvider>
            </ChatProvider>
          </AuthProvider>
        </PersistQueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
