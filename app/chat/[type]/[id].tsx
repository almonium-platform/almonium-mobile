import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
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
import { MessageActionsSheet, type MessageAction } from '@/components/message-actions';
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
  firstUnreadMessageId,
  interlocutor,
  isChannelType,
  seenByOthers,
  toChatMessage,
  transcriptRows,
  type ChatMessage,
  type ChatRow,
} from '@/src/chat';
import { languageName } from '@/src/languages';
import { useNotice } from '@/src/notice-context';
import { createThemedStyles, fonts, useTheme } from '@/src/theme';

/** How many older messages one page asks for. */
const pageSize = 30;
/** A bound on paging back to reach the unread divider, so a very old mark cannot spin forever. */
const maxPagesToDivider = 8;

export default function ChatRoomScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const showNotice = useNotice();
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

  const list = useRef<FlatList<ChatRow>>(null);
  const channelRef = useRef<Channel | null>(null);
  const loadingOlder = useRef(false);
  // Taken once when the room opens and then held, so marking the channel read does not pull the
  // divider out from under the person reading.
  const unreadAnchor = useRef<string | null>(null);
  const landed = useRef(false);
  const [ready, setReady] = useState(false);
  const [hasOlder, setHasOlder] = useState(true);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [acting, setActing] = useState<ChatMessage | null>(null);
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
    setSnapshot(snapshotOf(channel, userId, unreadAnchor.current));
    setHasOlder(channel.state.messagePagination.hasPrev);
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
        await channel.watch({ messages: { limit: pageSize } });
        if (!active) return;

        // Where reading stopped, before anything marks the channel read.
        unreadAnchor.current = firstUnreadMessageId(
          channel.state.read,
          userId,
          channel.state.messages,
        );

        // Opening lands on the divider, not on the newest message, so page back until the
        // boundary is loaded rather than painting a tail the mark is invisible in. Knowing the
        // id is not enough - the message it points at has to be on screen to divide anything.
        let pages = 0;
        while (
          active &&
          channel.countUnread() > 0 &&
          !isLoaded(channel, unreadAnchor.current) &&
          channel.state.messagePagination.hasPrev &&
          pages < maxPagesToDivider
        ) {
          await olderPage(channel);
          pages += 1;
          unreadAnchor.current = firstUnreadMessageId(
            channel.state.read,
            userId,
            channel.state.messages,
          );
        }
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

  /**
   * Scrolling back asks Stream for the page before the oldest message held. Whether more remains
   * comes from the SDK's own pagination terminator, not from counting the page that arrived - an
   * exactly-full page is not the end of the channel.
   */
  const loadOlder = useCallback(async () => {
    const channel = channelRef.current;
    if (!channel || !hasOlder || loadingOlder.current || !ready) return;
    loadingOlder.current = true;
    try {
      await olderPage(channel);
      capture();
    } catch {
      setHasOlder(false);
    } finally {
      loadingOlder.current = false;
    }
  }, [capture, hasOlder, ready]);

  const rows = useMemo(
    () => [...transcriptRows(snapshot.messages, { firstUnreadId: snapshot.firstUnreadId })].reverse(),
    [snapshot.firstUnreadId, snapshot.messages],
  );
  const dividerIndex = rows.findIndex((row) => row.kind === 'unread');

  // The list is inverted, so a larger viewPosition sits the divider higher up the screen and
  // leaves a screen of already-read context above it.
  useEffect(() => {
    if (landed.current || !ready || dividerIndex < 0) return;
    landed.current = true;
    requestAnimationFrame(() => {
      list.current?.scrollToIndex({ index: dividerIndex, viewPosition: 0.7, animated: false });
    });
  }, [dividerIndex, ready]);

  const title = snapshot.title || params.title || 'Chat';
  const unavailable = status !== 'ready' ? chatUnavailableCopy(status, error) : roomError;
  const empty = emptyCopy(type, channelId);

  async function send() {
    const channel = channelRef.current;
    const text = draft.trim();
    if (!channel || !text || sending) return;
    setSending(true);
    try {
      await channel.sendMessage({ text, ...(replyTo ? { quoted_message_id: replyTo.id } : {}) });
      setDraft('');
      setReplyTo(null);
    } catch (reason) {
      setRoomError(reason instanceof Error ? reason.message : 'That message was not sent.');
    } finally {
      setSending(false);
    }
  }

  function actionsFor(message: ChatMessage): MessageAction[] {
    const actions: MessageAction[] = [];
    if (snapshot.canSend && snapshot.canQuote) {
      actions.push({ key: 'reply', label: 'Reply', icon: 'arrow-undo-outline', run: () => setReplyTo(message) });
    }
    if (type !== channelTypes.self && !!message.text) {
      actions.push({
        key: 'save',
        label: 'Save to Saved Messages',
        icon: 'bookmark-outline',
        run: () => void saveToSelf(message),
      });
    }
    if (message.text) {
      actions.push({
        key: 'copy',
        label: 'Copy text',
        icon: 'copy-outline',
        run: () => void Clipboard.setStringAsync(message.text),
      });
    }
    if (snapshot.canMarkUnread) {
      actions.push({
        key: 'unread',
        label: 'Mark as unread from here',
        icon: 'chatbox-outline',
        run: () => void markUnreadFrom(message),
      });
    }
    return actions;
  }

  async function saveToSelf(message: ChatMessage) {
    if (!client || !userId) return;
    try {
      // The self chat's id is the user's own UUID; the backend created it at signup.
      await client.channel(channelTypes.self, userId).sendMessage({ text: message.text });
      showNotice({ title: 'Saved to Saved Messages', tone: 'success' });
    } catch {
      showNotice({ title: 'Could not save that message', message: 'Try again.', tone: 'error' });
    }
  }

  async function markUnreadFrom(message: ChatMessage) {
    const channel = channelRef.current;
    if (!channel) return;
    try {
      await channel.markUnread({ message_id: message.id });
      router.back();
    } catch {
      showNotice({ title: 'Could not mark as unread', message: 'Try again.', tone: 'error' });
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Go back" hitSlop={8} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <ChatAvatar type={type} channelId={channelId} image={snapshot.image} name={snapshot.title} size={38} />
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
          ref={list}
          inverted
          data={rows}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.transcript}
          keyboardDismissMode="on-drag"
          onEndReached={() => void loadOlder()}
          onEndReachedThreshold={0.4}
          // Index 0 is the newest message, so anchoring from index 1 keeps an arriving message
          // from shoving the read position.
          maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
          onScrollToIndexFailed={({ index }) => {
            requestAnimationFrame(() =>
              list.current?.scrollToIndex({ index, viewPosition: 0.7, animated: false }),
            );
          }}
          ListFooterComponent={
            hasOlder && rows.length > 0 ? (
              <ActivityIndicator style={styles.olderLoader} color={colors.metadata} />
            ) : null
          }
          renderItem={({ item }) => (
            <TranscriptRow
              row={item}
              seen={snapshot.seenMessageId}
              onLongPress={(message) => setActing(message)}
            />
          )}
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
          <View>
            {!!replyTo && (
              <View style={styles.replyBar}>
                <View style={styles.replyEdge} />
                <View style={styles.replyCopy}>
                  <Text style={styles.replyName}>{replyTo.own ? 'You' : replyTo.authorName ?? 'Reply'}</Text>
                  <Text numberOfLines={1} style={styles.replyText}>
                    {replyTo.text}
                  </Text>
                </View>
                <Pressable accessibilityLabel="Cancel reply" hitSlop={8} onPress={() => setReplyTo(null)}>
                  <Ionicons name="close" size={19} color={colors.muted} />
                </Pressable>
              </View>
            )}
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
          </View>
        ) : (
          <View style={styles.readOnly}>
            <Text style={styles.readOnlyText}>{broadcastFooter}</Text>
          </View>
        )}
      </KeyboardAvoidingView>

      <MessageActionsSheet
        visible={!!acting}
        actions={acting ? actionsFor(acting) : []}
        onClose={() => setActing(null)}>
        {!!acting && (
          <View style={[styles.messageRow, acting.own ? styles.messageRowOwn : styles.messageRowOther]}>
            <Bubble message={acting} startsRun lifted />
          </View>
        )}
      </MessageActionsSheet>
    </SafeAreaView>
  );
}

/**
 * The day divider owns the date and the bubble owns the time, so nothing here carries an author
 * line. Within a run the first bubble takes the avatar and squares the corner it meets the next
 * one at; the rest indent past the avatar column.
 */
function TranscriptRow({
  row,
  seen,
  onLongPress,
}: {
  row: ChatRow;
  seen: string | null;
  onLongPress(message: ChatMessage): void;
}) {
  const styles = useStyles();

  if (row.kind === 'day' || row.kind === 'unread') {
    const unread = row.kind === 'unread';
    return (
      <View style={styles.day}>
        <View style={[styles.dayRule, unread && styles.unreadRule]} />
        <Text style={[styles.dayText, unread && styles.unreadText]}>{row.label}</Text>
        <View style={[styles.dayRule, unread && styles.unreadRule]} />
      </View>
    );
  }

  const { message, startsRun } = row;
  return (
    <View style={[styles.messageRow, message.own ? styles.messageRowOwn : styles.messageRowOther]}>
      {!message.own &&
        (startsRun ? (
          <ChatAvatar type={channelTypes.private} image={message.authorImage} name={message.authorName} size={28} />
        ) : (
          <View style={styles.avatarSpacer} />
        ))}
      <Bubble
        message={message}
        startsRun={startsRun}
        read={message.own && message.id === seen}
        onLongPress={() => onLongPress(message)}
      />
    </View>
  );
}

function Bubble({
  message,
  startsRun,
  read = false,
  lifted = false,
  onLongPress,
}: {
  message: ChatMessage;
  startsRun: boolean;
  read?: boolean;
  lifted?: boolean;
  onLongPress?(): void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <Pressable
      disabled={!onLongPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      style={({ pressed }) => [
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
        lifted && styles.bubbleLifted,
        pressed && !!onLongPress && styles.bubblePressed,
      ]}>
      {!!message.quoted && (
        <View style={[styles.quote, message.own && styles.quoteOwn]}>
          <Text numberOfLines={1} style={[styles.quoteName, message.own && styles.quoteTextOwn]}>
            {message.quoted.authorName ?? 'Reply'}
          </Text>
          <Text numberOfLines={2} style={[styles.quoteText, message.own && styles.quoteTextOwn]}>
            {message.quoted.text}
          </Text>
        </View>
      )}
      <View style={styles.bubbleLine}>
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
    </Pressable>
  );
}

interface Snapshot {
  title: string;
  subtitle: string;
  image?: string;
  online: boolean;
  canSend: boolean;
  canQuote: boolean;
  canMarkUnread: boolean;
  messages: ChatMessage[];
  firstUnreadId: string | null;
  seenMessageId: string | null;
}

const emptySnapshot: Snapshot = {
  title: '',
  subtitle: '',
  online: false,
  canSend: true,
  canQuote: false,
  canMarkUnread: false,
  messages: [],
  firstUnreadId: null,
  seenMessageId: null,
};

function snapshotOf(channel: Channel, userId: string, firstUnreadId: string | null): Snapshot {
  const messages = channel.state.messages.map((message) => toChatMessage(message, userId));
  const other = interlocutor(channel, userId);
  const typing = Object.keys(channel.state.typing).filter((id) => id !== userId);
  const lastOwn = [...messages].reverse().find((message) => message.own);
  const capabilities = channel.data?.own_capabilities;

  return {
    title: channelTitle(channel, userId),
    subtitle: subtitleFor(channel, typing.length > 0, other),
    image: channelImage(channel, userId),
    online: Boolean(other?.online),
    canSend: canSendMessages(channel),
    // Quotes and read events are per-type toggles in the Stream dashboard, so the actions they
    // drive only appear where the API will actually accept them.
    canQuote: capable(capabilities, 'quote-message'),
    canMarkUnread: capable(capabilities, 'read-events'),
    messages,
    firstUnreadId,
    seenMessageId:
      lastOwn && seenByOthers(channel.state.read, userId, lastOwn.createdAt) ? lastOwn.id : null,
  };
}

function capable(capabilities: string[] | undefined, capability: string) {
  return Array.isArray(capabilities) && capabilities.includes(capability);
}

function isLoaded(channel: Channel, messageId: string | null) {
  return !!messageId && channel.state.messages.some((message) => message.id === messageId);
}

async function olderPage(channel: Channel) {
  const oldest = channel.state.messages[0];
  if (!oldest) return;
  await channel.query({ messages: { limit: pageSize, id_lt: oldest.id } }, 'current');
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
  day: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  dayRule: { flex: 1, height: 1, backgroundColor: colors.line },
  dayText: { color: colors.muted, fontSize: 11 },
  unreadRule: { backgroundColor: colors.accentBorder },
  unreadText: { color: colors.chatMine, fontFamily: fonts.sansMedium },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 9 },
  messageRowOwn: { justifyContent: 'flex-end' },
  messageRowOther: { justifyContent: 'flex-start' },
  avatarSpacer: { width: 28 },
  bubble: { maxWidth: '74%', gap: 5, borderRadius: 16, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 },
  bubbleLine: { flexDirection: 'row', alignItems: 'flex-end', gap: 9 },
  bubbleOwn: { backgroundColor: colors.chatMine },
  bubbleOther: { borderWidth: 1, borderColor: colors.line, backgroundColor: isDark ? colors.nested : colors.surface },
  tailOwn: { borderBottomRightRadius: 4 },
  continuesOwn: { borderTopRightRadius: 4 },
  tailOther: { borderBottomLeftRadius: 4 },
  continuesOther: { borderTopLeftRadius: 4 },
  bubbleDeleted: { backgroundColor: colors.nested, borderWidth: 1, borderColor: colors.line },
  bubbleLifted: { borderWidth: 2, borderColor: colors.accentBorder },
  bubblePressed: { opacity: 0.85 },
  quote: { borderLeftWidth: 2, borderLeftColor: colors.chatMine, paddingLeft: 8, paddingVertical: 1, gap: 1 },
  quoteOwn: { borderLeftColor: colors.white },
  quoteName: { color: colors.chatMine, fontFamily: fonts.sansMedium, fontSize: 11 },
  quoteText: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  quoteTextOwn: { color: colors.white, opacity: 0.8 },
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
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 16, paddingVertical: 8 },
  replyEdge: { width: 2, alignSelf: 'stretch', borderRadius: 1, backgroundColor: colors.chatMine },
  replyCopy: { flex: 1, gap: 1 },
  replyName: { color: colors.chatMine, fontFamily: fonts.sansMedium, fontSize: 11 },
  replyText: { color: colors.muted, fontSize: 12 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 16, paddingVertical: 8 },
  input: { flex: 1, minHeight: 44, maxHeight: 128, paddingVertical: 12, color: colors.ink, fontFamily: fonts.sans, fontSize: 13.5 },
  send: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  readOnly: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 16, paddingVertical: 14 },
  readOnlyText: { color: colors.muted, fontSize: 12 },
}));
