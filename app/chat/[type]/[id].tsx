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
  broadcastLanguage,
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
  type ChatMessage,
  type ChatRow,
} from '@/src/chat';
import { languageName } from '@/src/languages';
import { createThemedStyles, fonts, useTheme } from '@/src/theme';

/** How many older messages one scroll back asks for. */
const pageSize = 30;

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
  const loadingOlder = useRef(false);
  const [ready, setReady] = useState(false);
  const [hasOlder, setHasOlder] = useState(true);
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
        const response = await channel.watch({ messages: { limit: pageSize } });
        if (!active) return;
        setHasOlder(response.messages.length >= pageSize);
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

  /**
   * Scrolling back asks Stream for the page before the oldest message held. The list is
   * inverted, so its end is the top of the transcript.
   */
  const loadOlder = useCallback(async () => {
    const channel = channelRef.current;
    const oldest = channel?.state.messages[0];
    if (!channel || !oldest || !hasOlder || loadingOlder.current) return;
    loadingOlder.current = true;
    try {
      const response = await channel.query(
        { messages: { limit: pageSize, id_lt: oldest.id } },
        'current',
      );
      setHasOlder(response.messages.length >= pageSize);
      capture();
    } catch {
      setHasOlder(false);
    } finally {
      loadingOlder.current = false;
    }
  }, [capture, hasOlder]);

  const rows = useMemo(() => [...transcriptRows(snapshot.messages)].reverse(), [snapshot.messages]);
  const title = snapshot.title || params.title || 'Chat';
  const unavailable = status !== 'ready' ? chatUnavailableCopy(status, error) : roomError;
  const empty = emptyCopy(type, channelId);

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
        <ChatAvatar type={type} channelId={channelId} image={snapshot.image} size={38} />
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
          onEndReached={() => void loadOlder()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            hasOlder && rows.length > 0 ? (
              <ActivityIndicator style={styles.olderLoader} color={colors.metadata} />
            ) : null
          }
          renderItem={({ item }) => <TranscriptRow row={item} seen={snapshot.seenMessageId} />}
          ListEmptyComponent={
            !ready && !unavailable ? (
              <ActivityIndicator style={styles.loader} color={colors.primary} />
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>{unavailable ? 'This chat is not available' : empty.title}</Text>
                <Text style={styles.emptyCopy}>{unavailable ?? empty.copy}</Text>
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
              style={({ pressed }) => [styles.send, pressed && styles.pressed]}>
              <Ionicons
                name="send"
                size={21}
                color={draft.trim() && ready ? colors.chatMine : colors.disabledText}
              />
            </Pressable>
          </View>
        ) : (
          <View style={styles.readOnly}>
            <Text style={styles.readOnlyText}>{broadcastFooter}</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * The day divider owns the date and the bubble owns the time, so nothing here carries an author
 * line. Within a run the first bubble takes the avatar and squares off the corner it meets the
 * next one at; the rest indent past the avatar column.
 */
function TranscriptRow({ row, seen }: { row: ChatRow; seen: string | null }) {
  const styles = useStyles();
  const { colors } = useTheme();

  if (row.kind === 'day') {
    return (
      <View style={styles.day}>
        <View style={styles.dayRule} />
        <Text style={styles.dayText}>{row.label}</Text>
        <View style={styles.dayRule} />
      </View>
    );
  }

  const { message, startsRun } = row;
  const read = message.own && message.id === seen;

  return (
    <View style={[styles.messageRow, message.own ? styles.messageRowOwn : styles.messageRowOther]}>
      {!message.own &&
        (startsRun ? (
          <ChatAvatar type={channelTypes.private} image={message.authorImage} size={30} />
        ) : (
          <View style={styles.avatarSpacer} />
        ))}
      <View
        style={[
          styles.bubble,
          message.own ? styles.bubbleOwn : styles.bubbleOther,
          message.own
            ? startsRun
              ? styles.tailOwn
              : styles.continuesOwn
            : startsRun
              ? styles.tailOther
              : styles.continuesOther,
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
        <View style={styles.meta}>
          <Text style={[styles.stamp, message.own && styles.stampOwn]}>{clockTime(message.createdAt)}</Text>
          {read && <Ionicons name="checkmark-done" size={13} color={colors.white} style={styles.readMark} />}
        </View>
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
  messages: ChatMessage[];
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
    const language = broadcastLanguage(channel.id ?? '');
    return language ? `Channel · updates about ${languageName(language)}` : 'Channel · product updates';
  }
  // Saved Messages has nobody to be present, so its header carries no presence line.
  if (channel.type === channelTypes.self) return '';
  if (someoneTyping) return 'typing…';
  if (other?.online) return 'online';
  return other?.last_active ? `last seen ${relativeTime(other.last_active)}` : 'offline';
}

function emptyCopy(type: string, channelId: string) {
  if (type === channelTypes.self) {
    return {
      title: 'Your own notebook',
      copy: 'Forward messages here, or write to yourself. Nobody else can see this chat.',
    };
  }
  if (type === channelTypes.broadcast) {
    const language = broadcastLanguage(channelId);
    return {
      title: 'Nothing posted yet',
      copy: language
        ? `New books, packs and features for ${languageName(language)} will land here.`
        : 'New books, packs and features will land here.',
    };
  }
  return { title: 'Nothing here yet', copy: 'Write the first message.' };
}

const useStyles = createThemedStyles((colors, isDark) => ({
  safe: { flex: 1, backgroundColor: colors.canvas },
  header: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  back: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, gap: 2 },
  headerTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 17, fontWeight: '500' },
  headerSubtitle: { color: colors.muted, fontSize: 11 },
  headerOnline: { color: colors.chatMine },
  body: { flex: 1 },
  transcript: { flexGrow: 1, justifyContent: 'flex-end', paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  day: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  dayRule: { flex: 1, height: 1, backgroundColor: colors.line },
  dayText: { color: colors.muted, fontSize: 11 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  messageRowOwn: { justifyContent: 'flex-end' },
  messageRowOther: { justifyContent: 'flex-start' },
  avatarSpacer: { width: 30 },
  bubble: { maxWidth: '76%', flexDirection: 'row', alignItems: 'flex-end', gap: 10, borderRadius: 16, paddingHorizontal: 13, paddingTop: 9, paddingBottom: 7 },
  bubbleOwn: { backgroundColor: colors.chatMine },
  bubbleOther: { borderWidth: 1, borderColor: colors.line, backgroundColor: isDark ? colors.nested : colors.surface },
  tailOwn: { borderBottomRightRadius: 4 },
  continuesOwn: { borderTopRightRadius: 4 },
  tailOther: { borderBottomLeftRadius: 4 },
  continuesOther: { borderTopLeftRadius: 4 },
  bubbleDeleted: { backgroundColor: colors.nested, borderWidth: 1, borderColor: colors.line },
  messageText: { flexShrink: 1, color: colors.ink, fontFamily: fonts.sans, fontSize: 14, lineHeight: 21 },
  messageTextOwn: { color: colors.white },
  messageTextDeleted: { color: colors.metadata, fontStyle: 'italic' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingBottom: 1 },
  stamp: { color: colors.metadata, fontSize: 10.5 },
  stampOwn: { color: colors.white, opacity: 0.66 },
  readMark: { opacity: 0.66 },
  olderLoader: { paddingVertical: 14 },
  loader: { marginTop: 60 },
  empty: { flexGrow: 1, minHeight: 240, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 32 },
  emptyTitle: { color: colors.ink, fontFamily: fonts.serif, fontSize: 19, fontWeight: '500', textAlign: 'center' },
  emptyCopy: { color: colors.muted, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 16, paddingVertical: 8 },
  input: { flex: 1, minHeight: 44, maxHeight: 128, paddingVertical: 12, color: colors.ink, fontFamily: fonts.sans, fontSize: 13.5 },
  send: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  readOnly: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 16, paddingVertical: 14 },
  readOnlyText: { color: colors.muted, fontSize: 12 },
}));
