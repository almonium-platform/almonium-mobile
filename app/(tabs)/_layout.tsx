import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/src/auth-context';
import { fonts, useTheme } from '@/src/theme';

/**
 * The bar pays for its own row on top of the system inset rather than out of it. React Navigation
 * sizes the bar as one UIKit height plus the inset, which leaves 42pt of content for a 54pt item,
 * so on Android the labels slid down over the gesture bar. Height, padding and item are one sum.
 */
const tabBarPaddingTop = 7;
const tabBarItemHeight = 54;

export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { firebaseUser, profile, loading } = useAuth();
  if (!loading && !firebaseUser) return <Redirect href="/(auth)/sign-in" />;
  if (!loading && !profile) return <Redirect href="/" />;
  if (!loading && profile?.setupStep !== 'COMPLETED') return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.sansMedium, fontSize: 11 },
        tabBarItemStyle: { minHeight: tabBarItemHeight },
        tabBarStyle: {
          height: tabBarPaddingTop + tabBarItemHeight + insets.bottom,
          paddingTop: tabBarPaddingTop,
          paddingBottom: insets.bottom,
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
        },
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="books"
        options={{
          title: 'Read',
          tabBarIcon: ({ color, size }) => <Ionicons name="book" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="cards"
        options={{
          title: 'Review',
          tabBarIcon: ({ color, size }) => <Ionicons name="layers" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="lookup"
        options={{
          title: 'Look up',
          tabBarIcon: ({ color, size }) => <Ionicons name="search" color={color} size={size} />,
        }}
      />
      <Tabs.Screen name="play" options={{ href: null, title: 'Play' }} />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'More',
          href: null,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          href: null,
        }}
      />
      <Tabs.Screen name="people" options={{ href: null, title: 'People' }} />
    </Tabs>
  );
}
