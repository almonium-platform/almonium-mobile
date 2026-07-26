import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';

import { useAuth } from '@/src/auth-context';
import { colors } from '@/src/theme';

export default function TabsLayout() {
  const { firebaseUser, profile, loading } = useAuth();
  if (!loading && !firebaseUser) return <Redirect href="/(auth)/sign-in" />;
  if (!loading && !profile) return <Redirect href="/" />;
  if (!loading && profile?.setupStep !== 'COMPLETED') return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.canvas },
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.ink, fontWeight: '800' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
      }}>
      <Tabs.Screen
        name="books"
        options={{
          title: 'Library',
          tabBarIcon: ({ color, size }) => <Ionicons name="library" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
