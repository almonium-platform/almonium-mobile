import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { StreamChat } from 'stream-chat';

import { useAuth } from '@/src/auth-context';
import { config } from '@/src/config';

/**
 * Chat is authenticated separately from the backend: the API mints a Stream user token on
 * /users/me and this provider is the only place that spends it. The backend owns Stream users,
 * default memberships and the self chat, so nothing here ever creates any of them.
 */
type ChatStatus = 'unconfigured' | 'signed-out' | 'connecting' | 'ready' | 'error';

interface ChatState {
  client: StreamChat | null;
  status: ChatStatus;
  error: string | null;
  unreadCount: number;
  userId: string | null;
}

const ChatContext = createContext<ChatState | null>(null);

export function ChatProvider({ children }: PropsWithChildren) {
  const { profile } = useAuth();
  const userId = profile?.id ?? null;
  const token = profile?.streamChatToken ?? null;
  const [client, setClient] = useState<StreamChat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    setError(null);
    if (!config.streamApiKey || !userId || !token) {
      setClient(null);
      setUnreadCount(0);
      return;
    }

    const chatClient = StreamChat.getInstance(config.streamApiKey);
    let active = true;
    const connection = (async () => {
      if (chatClient.userID === userId) return;
      if (chatClient.userID) await chatClient.disconnectUser();
      await chatClient.connectUser({ id: userId }, token);
    })();

    void connection
      .then(() => {
        if (!active) return;
        setClient(chatClient);
        setUnreadCount(ownUnreadCount(chatClient));
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setClient(null);
        setError(reason instanceof Error ? reason.message : 'Could not connect to chat.');
      });

    return () => {
      active = false;
      setClient(null);
      // Wait for an in-flight connect before tearing it down, or the disconnect races past it.
      void connection.catch(() => undefined).then(() => chatClient.disconnectUser());
    };
  }, [token, userId]);

  useEffect(() => {
    if (!client) return;
    const subscription = client.on((event) => {
      if (typeof event.total_unread_count === 'number') setUnreadCount(event.total_unread_count);
    });
    return () => subscription.unsubscribe();
  }, [client]);

  const status: ChatStatus = !config.streamApiKey
    ? 'unconfigured'
    : !userId || !token
      ? 'signed-out'
      : error
        ? 'error'
        : client
          ? 'ready'
          : 'connecting';

  const value = useMemo<ChatState>(
    () => ({ client, status, error, unreadCount, userId }),
    [client, status, error, unreadCount, userId],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const value = useContext(ChatContext);
  if (!value) throw new Error('useChat must be used inside ChatProvider');
  return value;
}

/**
 * Message counting is on for `private` only, so this badges DMs and deliberately ignores the
 * self chat and the broadcast rooms.
 */
function ownUnreadCount(client: StreamChat) {
  const user = client.user;
  if (user && 'total_unread_count' in user) return Number(user.total_unread_count ?? 0);
  return 0;
}

/** The copy shown wherever chat cannot open, so every surface explains the same thing. */
export function chatUnavailableCopy(status: ChatStatus, error: string | null) {
  if (status === 'unconfigured') return 'Chat is not configured for this build.';
  if (status === 'signed-out') return 'Reconnect to load your chats. Chat needs a fresh sign-in.';
  return error ?? 'Chat could not be reached.';
}
