import type { StreamChat } from 'stream-chat';

/**
 * Reports go to Stream's moderation queue, which is where a flagged message or reader gets looked
 * at. Both stores ask that a reader can report the people and content they meet, and that the
 * report is acknowledged; the copy for the acknowledgement lives with the buttons that raise it.
 * The chat client is the only channel to that queue, so nothing is reported while it is down.
 */
export async function reportMessage(client: StreamChat, messageId: string) {
  await client.flagMessage(messageId);
}

export async function reportUser(client: StreamChat, userId: string) {
  await client.flagUser(userId);
}
