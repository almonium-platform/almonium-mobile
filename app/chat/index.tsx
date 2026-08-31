import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import type { Channel } from 'stream-chat';

import { ChatAvatar } from '@/components/chat-avatar';
import { chatUnavailableCopy, useChat } from '@/src/chat-client';
import {
  channelImage,
  channelPreview,
  channelTitle,
  channelTypes,
  clockTime,
  dayLabel,
  isChannelType,
  type ChannelType,
} from '@/src/chat';
import { createThemedStyles, fonts, useTheme } from '@/src/theme';

interface ChannelRow {
  key: string;
  type: ChannelType;
  id: string;
  title: string;
  preview: string;
  image?: string;
  stamp: string;
  unread: number;
  activity: number;
}

/** Events that change what a row says, so the list is rebuilt from live channel state. */
const listEvents = new Set([
  'message.new',
  'message.updated',
  'message.deleted',
  'notification.message_new',
  'notification.mark_read',
  'notification.added_to_channel',
  'channel.updated',
  'member.updated',
  'user.updated',
]);

export default function ChatListScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { client, status, error, userId } = useChat();
  const channels = useRef<Channel[]>([]);
  const [rows, setRows] = useState<ChannelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // Rows are rebuilt into a fresh array rather than read from mutable channel state during
  // render, so a live Stream update always reaches the screen.
  const rebuild = useCallback(() => {
    if (!userId) return;
    setRows(channels.current.map((channel) => toRow(channel, userId)).sort(byActivity));
  }, [userId]);

  const load = useCallback(async () => {
    if (!client || !userId) return;
    setListError(null);
    setLoading(true);
    try {
      channels.current = await client.queryChannels(
        { members: { $in: [userId] } },
        [{ last_message_at: -1 }],
        { watch: true, state: true, limit: 30, message_limit: 1 },
      );
      rebuild();
    } catch (reason) {
      setListError(reason instanceof Error ? reason.message : 'Your chats could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [client, rebuild, userId]);

  useEffect(() => {
    if (!client) {
      setLoading(status === 'connecting');
      return;
    }
    void load();
  }, [client, load, status]);

  useEffect(() => {
    if (!client) return;
    const subscription = client.on((event) => {
      if (listEvents.has(event.type)) rebuild();
    });
    return () => subscription.unsubscribe();
  }, [client, rebuild]);

  const unavailable = status !== 'ready' ? chatUnavailableCopy(status, error) : listError;

  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.key}
      contentContainerStyle={styles.list}
      refreshControl={
        client ? (
          <RefreshControl refreshing={loading && rows.length > 0} onRefresh={load} tintColor={colors.primary} />
        ) : undefined
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} accessibilityLabel="Go back" hitSlop={10} style={styles.back}>
            <Ionicons name="chevron-back" size={22} color={colors.muted} />
          </Pressable>
          <Text style={styles.title}>Chats</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: '/chat/[type]/[id]',
              params: { type: item.type, id: item.id, title: item.title },
            })
          }
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
          <ChatAvatar type={item.type} channelId={item.id} image={item.image} size={44} />
          <View style={styles.rowCopy}>
            <View style={styles.rowTop}>
              <Text numberOfLines={1} style={styles.rowTitle}>
                {item.title}
              </Text>
              {!!item.stamp && <Text style={styles.stamp}>{item.stamp}</Text>}
            </View>
            <View style={styles.rowBottom}>
              <Text numberOfLines={1} style={styles.rowPreview}>
                {item.preview}
              </Text>
              {/* A count here rather than a dot: there is no second column saying which chat is open. */}
              {item.unread > 0 && (
                <View accessibilityLabel={`${item.unread} unread`} style={styles.unread}>
                  <Text style={styles.unreadText}>{item.unread > 99 ? '99+' : item.unread}</Text>
                </View>
              )}
            </View>
          </View>
        </Pressable>
      )}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator style={styles.loader} color={colors.primary} />
        ) : (
          <View style={styles.empty}>
            <Ionicons
              name={unavailable ? 'cloud-offline-outline' : 'chatbubbles-outline'}
              size={40}
              color={colors.primary}
            />
            <Text style={styles.emptyTitle}>{unavailable ? 'Chat is not available' : 'No chats yet'}</Text>
            <Text style={styles.emptyCopy}>
              {unavailable ?? 'Open a friend from People to write to them, or keep notes in Saved Messages.'}
            </Text>
          </View>
        )
      }
    />
  );
}

function toRow(channel: Channel, userId: string): ChannelRow {
  const type = isChannelType(channel.type) ? channel.type : channelTypes.broadcast;
  const activity = channel.state.last_message_at?.getTime() ?? 0;
  return {
    key: channel.cid,
    type,
    id: channel.id ?? '',
    title: channelTitle(channel, userId),
    preview: channelPreview(channel, channel.state.messages, userId),
    image: channelImage(channel, userId),
    stamp: activity ? stampFor(new Date(activity)) : '',
    unread: channel.countUnread(),
    activity,
  };
}

function byActivity(a: ChannelRow, b: ChannelRow) {
  return b.activity - a.activity || a.title.localeCompare(b.title);
}

function stampFor(date: Date, now = new Date()) {
  const label = dayLabel(date, now);
  return label === 'Today' ? clockTime(date) : label;
}

const useStyles = createThemedStyles((colors) => ({
  list: { flexGrow: 1, padding: 20, paddingBottom: 36, backgroundColor: colors.canvas },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 10 },
  back: { width: 44, height: 44, marginLeft: -11, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: colors.ink, fontFamily: fonts.serif, fontSize: 21, fontWeight: '500' },
  row: { minHeight: 66, flexDirection: 'row', alignItems: 'center', gap: 11, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 11 },
  pressed: { opacity: 0.75 },
  rowCopy: { flex: 1, minWidth: 0, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { flex: 1, color: colors.ink, fontFamily: fonts.serif, fontSize: 15, fontWeight: '500' },
  rowPreview: { flex: 1, color: colors.muted, fontSize: 13 },
  stamp: { color: colors.muted, fontSize: 11 },
  unread: { minWidth: 19, alignItems: 'center', justifyContent: 'center', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1, backgroundColor: colors.chatMine },
  unreadText: { color: colors.white, fontFamily: fonts.sansMedium, fontSize: 11 },
  separator: { height: 2 },
  loader: { marginTop: 50 },
  empty: { minHeight: 310, alignItems: 'center', justifyContent: 'center', gap: 9, padding: 24 },
  emptyTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 22, fontWeight: '600', textAlign: 'center' },
  emptyCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
}));
