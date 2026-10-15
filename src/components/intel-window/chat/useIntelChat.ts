import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type FileUIPart, type UIMessage } from 'ai';
import useAuthHeader from 'react-auth-kit/hooks/useAuthHeader';
import useAuthUser from 'react-auth-kit/hooks/useAuthUser';
import { toast } from 'sonner';
import { RATE_LIMIT_MESSAGE, chatErrorKind, chatRequestBody } from '@/lib/intel-chat';
import { fetcherWithMethod, useAuthSWR } from '@/lib/swr';
import useIntelChatStore, { DEFAULT_CHAT_MODES } from '@/stores/intel-chat.store';
import type { ChatModes } from '@/types/IntelChat';
import type { User } from '@/types/User';

/** The prompt box modes of the logged-in user (kept in localStorage per user) */
export function useChatModes(): [ChatModes, (mode: keyof ChatModes, on: boolean) => void] {
  const userId = useAuthUser<User>()?._id ?? 'anon';
  const modes = useIntelChatStore((state) => state.modes[userId]) ?? DEFAULT_CHAT_MODES;
  const setMode = useIntelChatStore((state) => state.setMode);
  return [modes, (mode, on) => setMode(userId, mode, on)];
}

/**
 * One item's conversation (per user, stored on the server). History comes from GET /intel-chat/:id and is put into the
 * chat until the user does something in this mount; a send posts only the newest message plus the modes (contract).
 * Unmounting (another item, back to the timeline) stops a running stream; the server keeps what was produced.
 */
export function useIntelChat(articleId: number) {
  const authHeader = useAuthHeader() || '';
  const [modes] = useChatModes();
  const path = `/intel-chat/${articleId}`;
  const history = useAuthSWR<{ messages: UIMessage[] }>(path, { revalidateOnFocus: false });
  const { mutate } = history;
  const [postUnavailable, setPostUnavailable] = useState(false);

  // useChat reads the transport of the latest render on every send, so a new token or mode applies right away
  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: `${import.meta.env.API_BASE_URL}${path}`,
        prepareSendMessagesRequest: ({ messages }) => ({ body: chatRequestBody(messages, modes), headers: { Authorization: authHeader } }),
      }),
    [path, authHeader, modes],
  );

  const chat = useChat({
    id: `intel-${articleId}`,
    transport,
    onError: (error) => {
      const kind = chatErrorKind(error);
      if (kind === 'rate_limited') toast.error(RATE_LIMIT_MESSAGE);
      if (kind === 'ai_unavailable') setPostUnavailable(true);
    },
    // Keep the cached history in step, so coming back to this item shows the whole conversation at once. An errored
    // turn (429/503) wasn't saved by the server, so it stays out of the cache; an aborted one was (partly) saved.
    onFinish: ({ messages, isError }) => {
      if (!isError) void mutate({ messages }, { revalidate: false });
    },
  });
  const { setMessages, sendMessage, regenerate, stop, clearError } = chat;

  // History (cached or fresh) goes into the chat until the user sent, retried or reset something in this mount
  const touched = useRef(false);
  useEffect(() => {
    if (!history.data || touched.current) return;
    setMessages(Array.isArray(history.data.messages) ? history.data.messages : []);
  }, [history.data, setMessages]);

  const loadKind = history.error ? chatErrorKind(history.error) : null;
  return {
    messages: chat.messages,
    status: chat.status,
    loading: !history.data && !history.error,
    loadError: loadKind !== null && loadKind !== 'ai_unavailable',
    unavailable: postUnavailable || loadKind === 'ai_unavailable',
    send(text: string, image?: FileUIPart) {
      touched.current = true;
      void sendMessage(image ? { text, files: [image] } : { text });
    },
    retry() {
      touched.current = true;
      void regenerate();
    },
    stop() {
      void stop();
    },
    reload() {
      void mutate();
    },
    /** "Nieuw gesprek": stop, clear on the server, then locally */
    async reset() {
      touched.current = true;
      await stop();
      await fetcherWithMethod(path, authHeader, 'DELETE');
      setMessages([]);
      clearError();
      await mutate({ messages: [] }, { revalidate: false });
    },
  };
}

export type IntelChatState = ReturnType<typeof useIntelChat>;
