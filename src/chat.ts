/**
 * The conventions the Stream application enforces on every client that talks to it.
 *
 * These are shared state, not local choices: the web client addresses the same channels with the
 * same ids, and a client that guesses at them looks correct in isolation and wrong next to the web
 * app. See `docs/CHAT_INTEGRATION.md`. Keep this module free of React and React Native imports so
 * the rules stay unit-testable.
 */

/** The type is the only reliable answer to "what kind of channel is this?". Never the name. */
export const channelTypes = {
  private: 'private',
  self: 'self',
  broadcast: 'broadcast',
} as const;

export type ChannelType = (typeof channelTypes)[keyof typeof channelTypes];

export const selfChatName = 'Saved Messages';

/** The footer a broadcast room shows in place of a composer. */
export const broadcastFooter = 'Only Almonium posts in this channel';

interface UserLike {
  id?: string;
  name?: string;
  image?: string;
  online?: boolean;
  last_active?: string;
}

interface ChannelLike {
  type: string;
  data?: { name?: string; image?: string; own_capabilities?: string[] } | null;
  state?: { members: Record<string, { user?: UserLike | null }> };
}

interface MessageLike {
  id: string;
  text?: string;
  type?: string;
  created_at: Date | string;
  user?: UserLike | null;
}

export function isChannelType(value: string): value is ChannelType {
  return value === channelTypes.private || value === channelTypes.self || value === channelTypes.broadcast;
}

/**
 * A DM is derived from the friendship it belongs to, so both sides land on the same channel
 * without coordinating. Do not invent a second scheme.
 */
export function privateChannelId(friendshipId: string) {
  return `private_${friendshipId}`;
}

export function privateChannelCid(friendshipId: string) {
  return `${channelTypes.private}:${privateChannelId(friendshipId)}`;
}

/** The other member of a DM. A private chat has no name of its own, only an interlocutor. */
export function interlocutor(channel: ChannelLike, currentUserId: string): UserLike | undefined {
  return Object.values(channel.state?.members ?? {}).find(
    (member) => member.user?.id && member.user.id !== currentUserId,
  )?.user ?? undefined;
}

/**
 * Branch on the type first, so the leftover `name: 'Private Chat'` older DMs still carry in Stream
 * can never reach the screen.
 */
export function channelTitle(channel: ChannelLike, currentUserId: string, fallback = 'Chat') {
  if (channel.type === channelTypes.private) {
    return interlocutor(channel, currentUserId)?.name?.trim() || fallback;
  }
  return channel.data?.name?.trim() || fallback;
}

/** "Almonium — Deutsch" -> "Deutsch"; falls back to the whole name. */
export function broadcastTopic(channel: ChannelLike) {
  const name = channel.data?.name ?? '';
  const parts = name.split(/\s[—–-]\s/);
  return (parts.at(-1) ?? name).trim();
}

/**
 * Stream's channel-type permissions decide this, not the app. Read the capabilities the API sent
 * back and fall back to the type only until they arrive: a client-side check is presentation, and
 * the enforcement stays on the server.
 */
export function canSendMessages(channel: ChannelLike) {
  const capabilities = channel.data?.own_capabilities;
  if (Array.isArray(capabilities)) return capabilities.includes('send-message');
  return channel.type !== channelTypes.broadcast;
}

/** The self chat carries no image; its emblem is drawn locally rather than fetched or lettered. */
export function channelImage(channel: ChannelLike, currentUserId: string): string | undefined {
  if (channel.type === channelTypes.self) return undefined;
  if (channel.type === channelTypes.private) return interlocutor(channel, currentUserId)?.image;
  return channel.data?.image;
}

export function lastMessagePreview(
  messages: readonly MessageLike[],
  currentUserId: string,
  empty = 'No messages yet',
) {
  const last = messages.at(-1);
  if (!last) return empty;
  const text = last.type === 'deleted' ? 'Message deleted' : last.text?.replace(/\s+/g, ' ').trim();
  if (!text) return empty;
  return last.user?.id === currentUserId ? `You: ${text}` : text;
}

export interface ChatMessage {
  id: string;
  text: string;
  authorId?: string;
  authorName?: string;
  createdAt: Date;
  own: boolean;
  deleted: boolean;
}

export function toChatMessage(message: MessageLike, currentUserId: string): ChatMessage {
  return {
    id: message.id,
    text: message.type === 'deleted' ? 'Message deleted' : message.text ?? '',
    authorId: message.user?.id,
    authorName: message.user?.name,
    createdAt: new Date(message.created_at),
    own: message.user?.id === currentUserId,
    deleted: message.type === 'deleted',
  };
}

export type ChatRow =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'message'; key: string; message: ChatMessage; startsBlock: boolean; endsBlock: boolean };

/**
 * Chronological rows for the transcript: a dated divider whenever the day turns, plus flags for
 * the first and last message of a run by one author, so only the first carries a name and only
 * the last carries a timestamp.
 */
export function transcriptRows(messages: readonly ChatMessage[], now = new Date()): ChatRow[] {
  const rows: ChatRow[] = [];
  let day: string | null = null;
  let author: string | undefined;

  for (const message of messages) {
    const messageDay = dayKey(message.createdAt);
    const turned = messageDay !== day;
    if (turned) {
      rows.push({ kind: 'day', key: `day-${messageDay}`, label: dayLabel(message.createdAt, now) });
      day = messageDay;
      author = undefined;
    }
    rows.push({
      kind: 'message',
      key: message.id,
      message,
      startsBlock: turned || message.authorId !== author,
      endsBlock: true,
    });
    author = message.authorId;
  }

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const next = rows[index + 1];
    if (row.kind === 'message' && next?.kind === 'message') row.endsBlock = next.startsBlock;
  }

  return rows;
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function dayLabel(date: Date, now = new Date()) {
  if (dayKey(date) === dayKey(now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dayKey(date) === dayKey(yesterday)) return 'Yesterday';
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

export function clockTime(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Was a message of mine read by whoever else is in the room? */
export function seenByOthers(
  read: Record<string, { last_read: Date | string; user?: UserLike }>,
  currentUserId: string,
  createdAt: Date,
) {
  return Object.entries(read).some(
    ([userId, receipt]) =>
      userId !== currentUserId && new Date(receipt.last_read).getTime() >= createdAt.getTime(),
  );
}

/**
 * The Stream token is a credential. The web client strips it before writing the user to storage
 * and refetches it from `/users/me`; the offline profile cache here does the same.
 */
export function withoutStreamToken<T extends { streamChatToken?: string }>(profile: T): Omit<T, 'streamChatToken'> {
  const { streamChatToken: _token, ...rest } = profile;
  return rest;
}
