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
  quoted_message?: { id: string; text?: string; user?: UserLike | null } | null;
  attachments?: { title?: string; title_link?: string; og_scrape_url?: string; asset_url?: string }[];
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

/**
 * The mono emblem a broadcast room carries: `almonium-de` -> `DE`, the product-wide `almonium`
 * -> `ALM`. Derived from the id the backend owns, so it needs no hosted artwork.
 */
export function broadcastCode(channelId: string) {
  const language = broadcastLanguage(channelId);
  return language ?? 'ALM';
}

/** The language a broadcast room is about, or null for the product-wide room. */
export function broadcastLanguage(channelId: string): string | null {
  const [, language] = channelId.split('-');
  return language ? language.toUpperCase() : null;
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

/**
 * Only a DM has artwork worth fetching - the other person's. Saved Messages and the channels
 * draw their own emblems, so nothing on those rows depends on a hosted asset being reachable.
 */
export function channelImage(channel: ChannelLike, currentUserId: string): string | undefined {
  if (channel.type === channelTypes.private) return interlocutor(channel, currentUserId)?.image;
  return undefined;
}

/**
 * The second line of a channel row. Each type says its own thing when nothing has been said in
 * it yet, rather than sharing one placeholder.
 */
export function channelPreview(
  channel: ChannelLike,
  messages: readonly MessageLike[],
  currentUserId: string,
) {
  const last = messages.at(-1);
  const text = !last
    ? ''
    : last.type === 'deleted'
      ? 'Message deleted'
      : (last.text?.replace(/\s+/g, ' ').trim() ?? '');

  if (!text) {
    if (channel.type === channelTypes.self) return 'Only you can see this';
    if (channel.type === channelTypes.broadcast) return 'No updates yet';
    return 'No messages yet';
  }
  if (channel.type === channelTypes.self) return text;
  return last?.user?.id === currentUserId ? `You: ${text}` : text;
}

export interface ChatMessage {
  id: string;
  text: string;
  authorId?: string;
  authorName?: string;
  authorImage?: string;
  createdAt: Date;
  own: boolean;
  deleted: boolean;
  /** Quotes are the "Reply" action, on for `private`. Threads are a different feature, and off. */
  quoted?: { id: string; text: string; authorName?: string };
  /** A channel post carries the thing it announces as a footer action: the first link it holds. */
  link?: { label: string; url: string };
}

export function toChatMessage(message: MessageLike, currentUserId: string): ChatMessage {
  return {
    id: message.id,
    text: message.type === 'deleted' ? 'Message deleted' : message.text ?? '',
    authorId: message.user?.id,
    authorName: message.user?.name,
    authorImage: message.user?.image,
    createdAt: new Date(message.created_at),
    own: message.user?.id === currentUserId,
    deleted: message.type === 'deleted',
    quoted: message.quoted_message
      ? {
          id: message.quoted_message.id,
          text: message.quoted_message.text ?? '',
          authorName: message.quoted_message.user?.name,
        }
      : undefined,
    link: messageLink(message),
  };
}

/** The first link a post carries, from its attachments or the text itself. */
export function messageLink(message: Pick<MessageLike, 'text' | 'attachments'>): ChatMessage['link'] {
  const attachment = message.attachments?.find((entry) => entry.title_link || entry.og_scrape_url || entry.asset_url);
  if (attachment) {
    const url = attachment.title_link || attachment.og_scrape_url || attachment.asset_url!;
    return { label: attachment.title?.trim() || linkLabel(url), url };
  }
  const url = message.text?.match(/https?:\/\/[^\s)]+/)?.[0];
  return url ? { label: linkLabel(url), url } : undefined;
}

function linkLabel(url: string) {
  return /\/books?\//.test(url) || /\/reader\//.test(url) ? 'Open book' : /\/(c|d)\//.test(url) ? 'Open pack' : 'Open';
}

export type ChatRow =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'unread'; key: string; label: string }
  | { kind: 'message'; key: string; message: ChatMessage; startsRun: boolean };

/** The divider that marks where reading stopped. Held still while the room is open. */
export const unreadDividerLabel = 'Unread messages';

/** Consecutive messages from one sender group into a run while they stay this close together. */
export const runWindowMs = 5 * 60 * 1000;

/**
 * Chronological rows for the transcript: a dated divider whenever the day turns, and a flag for
 * the first message of a run. The divider owns the date and every bubble owns its own time, so
 * no author line or per-message date is ever needed.
 */
export function transcriptRows(
  messages: readonly ChatMessage[],
  { now = new Date(), firstUnreadId = null }: { now?: Date; firstUnreadId?: string | null } = {},
): ChatRow[] {
  const rows: ChatRow[] = [];
  let day: string | null = null;
  let previous: ChatMessage | undefined;

  for (const message of messages) {
    const messageDay = dayKey(message.createdAt);
    const turned = messageDay !== day;
    if (turned) {
      rows.push({ kind: 'day', key: `day-${messageDay}`, label: dayLabel(message.createdAt, now) });
      day = messageDay;
      previous = undefined;
    }
    // A divider breaks the run: the message under it opens a new one, avatar and corner included.
    const boundary = message.id === firstUnreadId;
    if (boundary) {
      rows.push({ kind: 'unread', key: 'unread-divider', label: unreadDividerLabel });
      previous = undefined;
    }
    const continues =
      !boundary &&
      !!previous &&
      previous.authorId === message.authorId &&
      message.createdAt.getTime() - previous.createdAt.getTime() <= runWindowMs;
    rows.push({ kind: 'message', key: message.id, message, startsRun: !continues });
    previous = message;
  }

  return rows;
}

/**
 * Where reading stopped, taken once when the room opens and then held: marking the channel read
 * immediately afterwards must not move the divider out from under the person reading.
 */
export function firstUnreadMessageId(
  read: Record<string, { first_unread_message_id?: string; last_read_message_id?: string; unread_messages?: number }>,
  currentUserId: string,
  messages: readonly { id: string }[],
): string | null {
  const own = read[currentUserId];
  if (!own || !own.unread_messages) return null;
  if (own.first_unread_message_id) return own.first_unread_message_id;
  // Older read state names the last read message instead; the divider goes after it.
  if (!own.last_read_message_id) return messages[0]?.id ?? null;
  const index = messages.findIndex((message) => message.id === own.last_read_message_id);
  return index >= 0 ? (messages[index + 1]?.id ?? null) : null;
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
