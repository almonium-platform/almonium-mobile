import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { Button } from '@/components/ui';
import { api } from '@/src/api';
import { useAuth } from '@/src/auth-context';
import { relativeTime } from '@/src/card-utils';
import { colors, fonts, shadows } from '@/src/theme';
import type { AppNotification, NotificationType } from '@/src/types';

const iconForType: Record<NotificationType, keyof typeof Ionicons.glyphMap> = {
  FRIENDSHIP_REQUESTED: 'person-add-outline',
  FRIENDSHIP_ACCEPTED: 'people-outline',
  TRANSLATION_ORDER_COMPLETED: 'book-outline',
};

export default function InboxScreen() {
  const { firebaseUser } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['notifications', firebaseUser?.uid],
    queryFn: api.notifications,
    enabled: Boolean(firebaseUser),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['notifications', firebaseUser?.uid] });
  const readMutation = useMutation({
    mutationFn: ({ id, read }: { id: string; read: boolean }) =>
      read ? api.markNotificationRead(id) : api.markNotificationUnread(id),
    onSuccess: refresh,
  });
  const allReadMutation = useMutation({
    mutationFn: api.markAllNotificationsRead,
    onSuccess: refresh,
  });
  const deleteMutation = useMutation({
    mutationFn: api.deleteNotification,
    onSuccess: refresh,
  });
  const relationshipMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'ACCEPT' | 'REJECT' }) =>
      api.manageRelationship(id, action),
    onSuccess: async () => {
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ['relationships'] });
    },
  });
  const unread = query.data?.filter((item) => !item.readAt).length ?? 0;

  function toggleRead(notification: AppNotification) {
    readMutation.mutate({ id: notification.id, read: !notification.readAt });
  }

  function confirmDelete(notification: AppNotification) {
    Alert.alert('Delete notification?', notification.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteMutation.mutate(notification.id),
      },
    ]);
  }

  return (
    <FlatList
      data={query.data ?? []}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={query.refetch}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>INBOX</Text>
              <Text style={styles.hero}>What’s new.</Text>
            </View>
            {unread > 0 && (
              <Pressable
                disabled={allReadMutation.isPending}
                onPress={() => allReadMutation.mutate()}
                style={styles.markAll}>
                <Text style={styles.markAllText}>Mark all read</Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.caption}>
            Friend activity and completed book translations appear here.
          </Text>
          {query.isError && query.data && (
            <Text style={styles.offline}>Showing saved notifications. Reconnect to refresh.</Text>
          )}
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => toggleRead(item)}
          onLongPress={() => confirmDelete(item)}
          style={({ pressed }) => [
            styles.notification,
            !item.readAt && styles.unread,
            pressed && styles.pressed,
          ]}>
          <View style={[styles.icon, !item.readAt && styles.iconUnread]}>
            <Ionicons
              name={iconForType[item.type] ?? 'notifications-outline'}
              size={21}
              color={colors.primaryDark}
            />
          </View>
          <View style={styles.copy}>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>{calmText(item.title)}</Text>
              <Text style={styles.time}>{relativeTime(item.createdAt)}</Text>
            </View>
            {!!item.message && <Text style={styles.message}>{calmText(item.message)}</Text>}
            {item.type === 'FRIENDSHIP_REQUESTED' && item.referenceId && !item.readAt && (
              <View style={styles.friendActions}>
                <Pressable
                  onPress={() => relationshipMutation.mutate({ id: item.referenceId!, action: 'ACCEPT' })}
                  style={styles.acceptAction}>
                  <Text style={styles.acceptText}>Accept</Text>
                </Pressable>
                <Pressable
                  onPress={() => relationshipMutation.mutate({ id: item.referenceId!, action: 'REJECT' })}
                  style={styles.declineAction}>
                  <Text style={styles.declineText}>Decline</Text>
                </Pressable>
                {item.senderId && (
                  <Pressable onPress={() => router.push({ pathname: '/profile/[userId]', params: { userId: item.senderId! } })}>
                    <Text style={styles.profileLink}>Profile</Text>
                  </Pressable>
                )}
              </View>
            )}
            <Text style={styles.action}>
              Tap to mark {item.readAt ? 'unread' : 'read'} · Hold to delete
            </Text>
          </View>
          {!item.readAt && <View style={styles.dot} />}
        </Pressable>
      )}
      ItemSeparatorComponent={() => <View style={{ height: 11 }} />}
      ListEmptyComponent={
        <SafeAreaView style={styles.empty}>
          <Ionicons
            name={query.isError ? 'cloud-offline-outline' : 'notifications-off-outline'}
            size={43}
            color={colors.primary}
          />
          <Text style={styles.emptyTitle}>
            {query.isError ? 'Inbox unavailable' : 'All quiet for now'}
          </Text>
          <Text style={styles.emptyText}>
            {query.isError
              ? query.error instanceof Error ? query.error.message : 'Check your connection.'
              : 'New friendship and translation updates will appear here.'}
          </Text>
          {query.isError && <Button onPress={() => query.refetch()}>Try again</Button>}
        </SafeAreaView>
      }
    />
  );
}

function calmText(value: string) {
  return value.replace(/!+/g, '').trim();
}

const styles = StyleSheet.create({
  list: { flexGrow: 1, padding: 20, paddingBottom: 36, backgroundColor: colors.canvas },
  header: { gap: 9, paddingBottom: 21 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerCopy: { flex: 1, gap: 3 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: '600', letterSpacing: 1.5 },
  hero: { color: colors.ink, fontFamily: fonts.serif, fontSize: 30, lineHeight: 36, fontWeight: '600' },
  caption: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  markAll: { paddingVertical: 8, paddingHorizontal: 11, borderRadius: 11, backgroundColor: colors.accentSoft },
  markAllText: { color: colors.primaryDark, fontWeight: '600', fontSize: 12 },
  offline: { color: colors.primaryDark, fontSize: 12, fontWeight: '600', backgroundColor: colors.accentSoft, borderRadius: 10, padding: 10 },
  notification: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 15, borderRadius: 20, backgroundColor: colors.surface, ...shadows.card },
  unread: { backgroundColor: '#fffafd' },
  icon: { width: 43, height: 43, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  iconUnread: { backgroundColor: colors.accentSoft },
  copy: { flex: 1, gap: 5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, color: colors.ink, fontSize: 15, fontWeight: '600' },
  time: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  message: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  action: { color: colors.primary, fontSize: 10, fontWeight: '600', paddingTop: 1 },
  friendActions: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingTop: 4 },
  acceptAction: { minHeight: 40, justifyContent: 'center', borderRadius: 20, paddingHorizontal: 13, backgroundColor: colors.primary },
  acceptText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  declineAction: { minHeight: 40, justifyContent: 'center', borderRadius: 20, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.line },
  declineText: { color: colors.ink, fontSize: 12, fontWeight: '600' },
  profileLink: { color: colors.primary, fontSize: 12, fontWeight: '600', paddingHorizontal: 4 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary, marginTop: 7 },
  pressed: { opacity: 0.78 },
  empty: { flex: 1, minHeight: 420, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyTitle: { color: colors.ink, fontWeight: '600', fontSize: 20 },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 300 },
});
