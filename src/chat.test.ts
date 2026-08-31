import { describe, expect, it } from 'vitest';

import {
  broadcastCode,
  broadcastLanguage,
  canSendMessages,
  channelImage,
  channelTitle,
  clockTime,
  dayLabel,
  firstUnreadMessageId,
  channelPreview,
  interlocutor,
  isChannelType,
  privateChannelCid,
  privateChannelId,
  seenByOthers,
  toChatMessage,
  transcriptRows,
  withoutStreamToken,
} from './chat';

const me = 'a3f1c0de-0000-0000-0000-000000000001';
const friend = 'a3f1c0de-0000-0000-0000-000000000002';

function dm(overrides: { name?: string; friendName?: string } = {}) {
  return {
    type: 'private',
    data: overrides.name === undefined ? {} : { name: overrides.name },
    state: {
      members: {
        [me]: { user: { id: me, name: 'kuzanorest' } },
        [friend]: { user: { id: friend, name: overrides.friendName ?? 'wowsie' } },
      },
    },
  };
}

describe('channel addressing', () => {
  it('derives a DM id from the friendship so both sides land in the same room', () => {
    expect(privateChannelId('f00d')).toBe('private_f00d');
    expect(privateChannelCid('f00d')).toBe('private:private_f00d');
  });

  it('recognises only the three types the Stream application defines', () => {
    expect(isChannelType('private')).toBe(true);
    expect(isChannelType('self')).toBe(true);
    expect(isChannelType('broadcast')).toBe(true);
    expect(isChannelType('messaging')).toBe(false);
  });
});

describe('channel identity', () => {
  it('titles a DM by its interlocutor', () => {
    expect(interlocutor(dm(), me)?.id).toBe(friend);
    expect(channelTitle(dm(), me)).toBe('wowsie');
  });

  it('never lets the leftover Private Chat name reach the screen', () => {
    expect(channelTitle(dm({ name: 'Private Chat' }), me)).toBe('wowsie');
  });

  it('falls back when a DM has no readable interlocutor', () => {
    expect(channelTitle({ type: 'private', state: { members: {} } }, me, 'Chat')).toBe('Chat');
  });

  it('titles every other type by its name', () => {
    expect(channelTitle({ type: 'self', data: { name: 'Saved Messages' } }, me)).toBe('Saved Messages');
    expect(channelTitle({ type: 'broadcast', data: { name: 'Almonium - Deutsch' } }, me)).toBe(
      'Almonium - Deutsch',
    );
  });

  it('reads a broadcast emblem out of the id the backend owns', () => {
    expect(broadcastCode('almonium-de')).toBe('DE');
    expect(broadcastCode('almonium')).toBe('ALM');
    expect(broadcastLanguage('almonium-it')).toBe('IT');
    expect(broadcastLanguage('almonium')).toBeNull();
  });

  it('draws the self and channel emblems locally rather than fetching artwork', () => {
    expect(channelImage({ type: 'self', data: { image: 'https://example.test/x.png' } }, me)).toBeUndefined();
    expect(channelImage({ type: 'broadcast', data: { image: 'https://a.test/logo-de.png' } }, me)).toBeUndefined();
  });
});

describe('who may post', () => {
  it('trusts the capabilities Stream sent back', () => {
    expect(canSendMessages({ type: 'broadcast', data: { own_capabilities: ['read-events'] } })).toBe(false);
    expect(canSendMessages({ type: 'private', data: { own_capabilities: ['send-message'] } })).toBe(true);
  });

  it('assumes a broadcast room is read only until capabilities arrive', () => {
    expect(canSendMessages({ type: 'broadcast' })).toBe(false);
    expect(canSendMessages({ type: 'self' })).toBe(true);
  });
});

describe('transcript', () => {
  const day = (iso: string) => new Date(iso);
  /** Local wall-clock, so day boundaries do not move with the machine's timezone. */
  const at = (month: number, date: number, hour: number, minute = 0) =>
    new Date(2026, month, date, hour, minute);

  it('previews the last message, marks your own, and lets each type speak when empty', () => {
    expect(channelPreview({ type: 'private' }, [], me)).toBe('No messages yet');
    expect(channelPreview({ type: 'self' }, [], me)).toBe('Only you can see this');
    expect(channelPreview({ type: 'broadcast' }, [], me)).toBe('No updates yet');
    expect(
      channelPreview({ type: 'private' }, [{ id: '1', text: 'hello  brooo', created_at: at(7, 31, 10), user: { id: friend } }], me),
    ).toBe('hello brooo');
    expect(
      channelPreview({ type: 'private' }, [{ id: '1', text: 'woww', created_at: at(7, 31, 10), user: { id: me } }], me),
    ).toBe('You: woww');
    // Everything in Saved Messages is yours, so prefixing every line with "You:" says nothing.
    expect(
      channelPreview({ type: 'self' }, [{ id: '1', text: 'a note', created_at: at(7, 31, 10), user: { id: me } }], me),
    ).toBe('a note');
  });

  it('maps a Stream message onto what the bubble needs', () => {
    const message = toChatMessage(
      { id: '1', text: 'hi', created_at: '2026-08-31T10:00:00Z', user: { id: friend, name: 'wowsie' } },
      me,
    );
    expect(message).toMatchObject({ id: '1', text: 'hi', own: false, authorName: 'wowsie', deleted: false });
    expect(message.createdAt.toISOString()).toBe('2026-08-31T10:00:00.000Z');
    expect(toChatMessage({ id: '2', type: 'deleted', created_at: '2026-08-31T10:00:00Z' }, me).text).toBe(
      'Message deleted',
    );
  });

  it('divides on the day and opens a run when the sender or the 5-minute window changes', () => {
    const now = at(7, 31, 12);
    const rows = transcriptRows(
      [
        { id: '1', text: 'a', createdAt: at(7, 30, 9), authorId: friend, own: false, deleted: false },
        { id: '2', text: 'b', createdAt: at(7, 31, 9), authorId: friend, own: false, deleted: false },
        { id: '3', text: 'c', createdAt: at(7, 31, 9, 1), authorId: friend, own: false, deleted: false },
        { id: '4', text: 'd', createdAt: at(7, 31, 9, 9), authorId: friend, own: false, deleted: false },
        { id: '5', text: 'e', createdAt: at(7, 31, 9, 10), authorId: me, own: true, deleted: false },
      ],
      { now },
    );
    expect(rows.map((row) => row.kind)).toEqual([
      'day', 'message', 'day', 'message', 'message', 'message', 'message',
    ]);
    expect(rows.filter((row) => row.kind === 'day').map((row) => row.label)).toEqual(['Yesterday', 'Today']);
    expect(rows.filter((row) => row.kind === 'message').map((row) => row.startsRun)).toEqual([
      true, // first of the day
      true, // first of the day
      false, // same sender, one minute later
      true, // same sender, but eight minutes on
      true, // different sender
    ]);
  });

  it('breaks the run at the unread divider and puts it before the first unread message', () => {
    const now = at(7, 31, 12);
    const messages = [
      { id: '1', text: 'a', createdAt: at(7, 31, 9), authorId: friend, own: false, deleted: false },
      { id: '2', text: 'b', createdAt: at(7, 31, 9, 1), authorId: friend, own: false, deleted: false },
      { id: '3', text: 'c', createdAt: at(7, 31, 9, 2), authorId: friend, own: false, deleted: false },
    ];
    const rows = transcriptRows(messages, { now, firstUnreadId: '2' });
    expect(rows.map((row) => row.kind)).toEqual(['day', 'message', 'unread', 'message', 'message']);
    // The message under the divider opens a run, so it keeps its avatar and squared corner.
    expect(rows.filter((row) => row.kind === 'message').map((row) => row.startsRun)).toEqual([
      true,
      true,
      false,
    ]);
    expect(transcriptRows(messages, { now }).some((row) => row.kind === 'unread')).toBe(false);
  });

  it('finds where reading stopped, and says nothing when everything is read', () => {
    const messages = [{ id: '1' }, { id: '2' }, { id: '3' }];
    expect(firstUnreadMessageId({ [me]: { unread_messages: 0 } }, me, messages)).toBeNull();
    expect(
      firstUnreadMessageId({ [me]: { unread_messages: 2, first_unread_message_id: '2' } }, me, messages),
    ).toBe('2');
    // Read state that only names the last read message puts the divider after it.
    expect(
      firstUnreadMessageId({ [me]: { unread_messages: 2, last_read_message_id: '1' } }, me, messages),
    ).toBe('2');
    // The boundary is older than anything loaded, so there is nothing to draw yet.
    expect(
      firstUnreadMessageId({ [me]: { unread_messages: 2, last_read_message_id: 'x' } }, me, messages),
    ).toBeNull();
    expect(firstUnreadMessageId({}, me, messages)).toBeNull();
  });

  it('names the day relative to now', () => {
    const now = at(7, 31, 12);
    expect(dayLabel(now, now)).toBe('Today');
    expect(dayLabel(at(7, 30, 23), now)).toBe('Yesterday');
    expect(dayLabel(at(7, 20, 12), now)).not.toBe('Today');
  });

  it('shows a clock time without the date', () => {
    expect(clockTime(at(7, 31, 22, 16))).toMatch(/16/);
  });

  it('reads a receipt only from someone else', () => {
    const createdAt = day('2026-08-31T10:00:00Z');
    expect(
      seenByOthers({ [me]: { last_read: day('2026-08-31T11:00:00Z') } }, me, createdAt),
    ).toBe(false);
    expect(
      seenByOthers({ [friend]: { last_read: day('2026-08-31T09:00:00Z') } }, me, createdAt),
    ).toBe(false);
    expect(
      seenByOthers({ [friend]: { last_read: day('2026-08-31T11:00:00Z') } }, me, createdAt),
    ).toBe(true);
  });
});

describe('the Stream token', () => {
  it('is stripped from anything written to storage', () => {
    const cached = withoutStreamToken({ id: me, username: 'kuzanorest', streamChatToken: 'ey.secret' });
    expect(cached).toEqual({ id: me, username: 'kuzanorest' });
    expect(cached).not.toHaveProperty('streamChatToken');
  });
});
