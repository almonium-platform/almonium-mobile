import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Channel } from 'stream-chat';

import { ChatAvatar } from '@/components/chat-avatar';
import { relativeTime } from '@/src/card-utils';
import { chatUnavailableCopy, useChat } from '@/src/chat-client';
import {
  broadcastFooter,
  broadcastTopic,
  canSendMessages,
  channelImage,
  channelTitle,
  channelTypes,
  clockTime,
  interlocutor,
  isChannelType,
  seenByOthers,
  toChatMessage,
  transcriptRows,
  type ChatRow,
} from '@/src/chat';
import { createThemedStyles, fonts, radii, shadows, useTheme } from '@/src/theme';

export default function ChatRoomScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { client, status, error, userId } = useChat();
  const params = useLocalSearchParams<{
    type: string;
    id: string;
    recipientId?: string;
    title?: string;
  }>();
  const type = isChannelType(params.type) ? params.type : channelTypes.private;
  const channelId = params.id ?? '';
  const recipientId = params.recipientId;

  const channelRef = useRef<Channel | null>(null);
  const [ready, setReady] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  // Until the channel answers, assume a broadcast room is read only, the way canSendMessages does.
  const [snapshot, setSnapshot] = useState<Snapshot>(() => ({
    ...emptySnapshot,
    canSend: type !== channelTypes.broadcast,
  }));

  // Snapshots are plain values copied out of the channel's mutable state, so every Stream event
  // produces a new object and the transcript actually re-renders.
  const capture = useCallback(() => {
    const channel = channelRef.current;
    if (!channel || !userId) return;
    setSnapshot(snapshotOf(channel, userId));
  }, [userId]);

  useEffect(() => {
    if (!client || !userId || !channelId) return;
    let active = true;
    // A DM is addressed by its friendship, and creating it is how the recipient is joined; every
    // other channel already exists, because the backend owns memberships.
    const channel =
      recipientId && type === channelTypes.private
        ? client.channel(type, channelId, {
            members: [userId, recipientId],
            created_by_id: userId,
          })
        : client.channel(type, channelId);
    channelRef.current = channel;

    const subscription = channel.on((event) => {
      if (!active) return;
      capture();
      if (event.type === 'message.new' && event.user?.id !== userId) {
        void channel.markRead().catch(() => undefined);
      }
    });

    void (async () => {
      try {
        if (recipientId && type === channelTypes.private) await channel.create();
        await channel.watch();
        if (!active) return;
        setReady(true);
        capture();
        await channel.markRead().catch(() => undefined);
      } catch (reason) {
        if (!active) return;
        setRoomError(reason instanceof Error ? reason.message : 'This chat could not be opened.');
      }
    })();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [capture, channelId, client, recipientId, type, userId]);

  const rows = useMemo(() => [...transcriptRows(snapshot.messages)].reverse(), [snapshot.messages]);
  const title = snapshot.title || params.title || 'Chat';
  const unavailable = status !== 'ready' ? chatUnavailableCopy(status, error) : roomError;

  async function send() {
    const channel = channelRef.current;
    const text = draft.trim();
    if (!channel || !text || sending) return;
    setSending(true);
    try {
      await channel.sendMessage({ text });
      setDraft('');
    } catch (reason) {
      setRoomError(reason instanceof Error ? reason.message : 'That message was not sent.');
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back" hitSlop={8} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <ChatAvatar type={type} image={snapshot.image} size={40} />
        <View style={styles.headerCopy}>
          <Text numberOfLines={1} style={styles.headerTitle}>
            {title}
          </Text>
          {!!snapshot.subtitle && (
            <Text numberOfLines={1} style={[styles.headerSubtitle, snapshot.online && styles.headerOnline]}>
              {snapshot.subtitle}
            </Text>
          )}
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        style={styles.body}>
        <FlatList
          inverted
          data={rows}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.transcript}
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => <TranscriptRow row={item} showAuthor={type !== channelTypes.private} seen={snapshot.seenMessageId} />}
          ListEmptyComponent={
            !ready && !unavailable ? (
              <ActivityIndicator style={styles.loader} color={colors.primary} />
            ) : (
              <View style={styles.empty}>
                <Ionicons
                  name={unavailable ? 'cloud-offline-outline' : type === channelTypes.self ? 'bookmark-outline' : 'chatbubble-ellipses-outline'}
                  size={36}
                  color={colors.primary}
                />
                <Text style={styles.emptyTitle}>{unavailable ? 'This chat is not available' : 'Nothing here yet'}</Text>
                <Text style={styles.emptyCopy}>
                  {unavailable ??
                    (type === channelTypes.self
                      ? 'Keep a note, a phrase, or anything worth coming back to.'
                      : type === channelTypes.broadcast
                        ? 'Almonium has not posted in this room yet.'
                        : 'Write the first message.')}
                </Text>
              </View>
            )
          }
        />

        {snapshot.canSend ? (
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={(value) => {
                setDraft(value);
                void channelRef.current?.keystroke().catch(() => undefined);
              }}
              placeholder="Write a message"
              placeholderTextColor={colors.muted}
              multiline
              autoCapitalize="sentences"
              editable={ready}
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              disabled={!draft.trim() || sending || !ready}
              onPress={() => void send()}
              style={({ pressed }) => [
                styles.send,
                (!draft.trim() || sending || !ready) && styles.sendDisabled,
                pressed && styles.pressed,
              ]}>
              <Ionicons
                name="arrow-up"
                size={20}
                color={draft.trim() && ready ? colors.onPrimary : colors.disabledText}
              />
            </Pressable>
          </View>
        ) : (
          <View style={styles.readOnly}>
            <Ionicons name="megaphone-outline" size={17} color={colors.muted} />
            <Text style={styles.readOnlyText}>{broadcastFooter}</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function TranscriptRow({
  row,
  showAuthor,
  seen,
}: {
  row: ChatRow;
  showAuthor: boolean;
  seen: string | null;
}) {
  const styles = useStyles();
  if (row.kind === 'day') {
    return (
      <View style={styles.day}>
        <Text style={styles.dayText}>{row.label}</Text>
      </View>
    );
  }

  const { message } = row;
  return (
    <View style={[styles.messageRow, message.own ? styles.messageRowOwn : styles.messageRowOther]}>
      <View style={styles.messageColumn}>
        {showAuthor && !message.own && row.startsBlock && !!message.authorName && (
          <Text style={styles.author}>{message.authorName}</Text>
        )}
        <View
          style={[
            styles.bubble,
            message.own ? styles.bubbleOwn : styles.bubbleOther,
            message.deleted && styles.bubbleDeleted,
          ]}>
          <Text
            style={[
              styles.messageText,
              message.own && styles.messageTextOwn,
              message.deleted && styles.messageTextDeleted,
            ]}>
            {message.text}
          </Text>
        </View>
        {row.endsBlock && (
          <Text style={[styles.stamp, message.own && styles.stampOwn]}>
            {clockTime(message.createdAt)}
            {message.own && message.id === seen ? ' · Read' : ''}
          </Text>
        )}
      </View>
    </View>
  );
}

interface Snapshot {
  title: string;
  subtitle: string;
  image?: string;
  online: boolean;
  canSend: boolean;
  messages: ReturnType<typeof toChatMessage>[];
  seenMessageId: string | null;
}

const emptySnapshot: Snapshot = {
  title: '',
  subtitle: '',
  online: false,
  canSend: true,
  messages: [],
  seenMessageId: null,
};

function snapshotOf(channel: Channel, userId: string): Snapshot {
  const messages = channel.state.messages.map((message) => toChatMessage(message, userId));
  const other = interlocutor(channel, userId);
  const typing = Object.keys(channel.state.typing).filter((id) => id !== userId);
  const lastOwn = [...messages].reverse().find((message) => message.own);

  return {
    title: channelTitle(channel, userId),
    subtitle: subtitleFor(channel, typing.length > 0, other),
    image: channelImage(channel, userId),
    online: Boolean(other?.online),
    canSend: canSendMessages(channel),
    messages,
    seenMessageId:
      lastOwn && seenByOthers(channel.state.read, userId, lastOwn.createdAt) ? lastOwn.id : null,
  };
}

function subtitleFor(
  channel: Channel,
  someoneTyping: boolean,
  other: ReturnType<typeof interlocutor>,
) {
  if (channel.type === channelTypes.broadcast) {
    return `Channel · updates about ${broadcastTopic(channel)}`;
  }
  if (channel.type === channelTypes.self) return 'Only you';
  if (someoneTyping) return 'typing…';
  if (other?.online) return 'online';
  return other?.last_active ? `last seen ${relativeTime(other.last_active)}` : 'offline';
}

const useStyles = createThemedStyles((colors, isDark) => ({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  back: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, gap: 2 },
  headerTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 18, fontWeight: '600' },
  headerSubtitle: { color: colors.muted, fontSize: 11 },
  headerOnline: { color: colors.primary },
  body: { flex: 1 },
  transcript: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: 16, paddingVertical: 14, gap: 4 },
  day: { alignItems: 'center', paddingVertical: 10 },
  dayText: { color: colors.metadata, fontFamily: fonts.sansMedium, fontSize: 11 },
  messageRow: { flexDirection: 'row' },
  messageRowOwn: { justifyContent: 'flex-end' },
  messageRowOther: { justifyContent: 'flex-start' },
  messageColumn: { maxWidth: '82%', gap: 3 },
  author: { color: colors.muted, fontFamily: fonts.sansMedium, fontSize: 11, paddingHorizontal: 4 },
  bubble: { borderRadius: radii.panel, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleOwn: { backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  bubbleOther: { backgroundColor: colors.surface, borderBottomLeftRadius: 6, ...(isDark ? { borderWidth: 1, borderColor: colors.line } : shadows.card) },
  bubbleDeleted: { backgroundColor: colors.nested, borderWidth: 1, borderColor: colors.line },
  messageText: { color: colors.ink, fontFamily: fonts.sans, fontSize: 15, lineHeight: 21 },
  messageTextOwn: { color: colors.onPrimary },
  messageTextDeleted: { color: colors.metadata, fontStyle: 'italic' },
  stamp: { color: colors.metadata, fontSize: 10, paddingHorizontal: 4, paddingBottom: 4 },
  stampOwn: { textAlign: 'right' },
  loader: { marginTop: 60 },
  empty: { flexGrow: 1, minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  emptyTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 20, fontWeight: '600', textAlign: 'center' },
  emptyCopy: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, backgroundColor: colors.canvas },
  input: { flex: 1, minHeight: 46, maxHeight: 128, borderWidth: 1, borderColor: colors.border, borderRadius: radii.control, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, color: colors.ink, fontFamily: fonts.sans, fontSize: 15, backgroundColor: colors.surface },
  send: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: colors.primary },
  sendDisabled: { backgroundColor: colors.disabled },
  pressed: { opacity: 0.75 },
  readOnly: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 16, paddingVertical: 14 },
  readOnlyText: { color: colors.muted, fontSize: 12 },
}));
