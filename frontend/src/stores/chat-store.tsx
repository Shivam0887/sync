import type {
  IChatState,
  IChatActions,
  Conversation,
  Message,
} from "@/types/chat.types";

import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createSelectors } from "@/lib/utils";
import { apiRequest } from "@/services/api-request";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

const chatQueryKeys = {
  conversations: ["conversations"] as const,
  messages: (chatId: string) => ["message", chatId] as const,
};

export function converationOptions() {
  return queryOptions({
    queryKey: chatQueryKeys.conversations,
    queryFn: async () => {
      const res = await apiRequest("/chat/conversations");

      if (!res.ok) throw new Error("Failed to fetch conversations");

      const data = await res.json();
      return (data.conversations as Conversation[]).reduce(
        (result, conversation) => {
          result[conversation.id] = conversation;

          return result;
        },
        {} as Record<string, Conversation>
      );
    },
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
}

export function chatMessageOptions(chatId: string) {
  return queryOptions({
    queryKey: chatQueryKeys.messages(chatId),
    queryFn: async (): Promise<Message[]> => {
      const res = await apiRequest(`/chat/${chatId}/messages`);

      if (!res.ok) throw new Error("Failed to fetch messages");

      const data = await res.json();
      return data.messages;
    },
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchInterval: false,
    refetchIntervalInBackground: false,
  });
}

export const useFetchConversations = () => useQuery(converationOptions());

export const useFetchChatMessages = (chatId: string) =>
  useQuery(chatMessageOptions(chatId));

const useChatStoreBase = create<IChatState & IChatActions>()(
  devtools((set) => ({
    // Initial state
    userPresence: {},
    typingStatus: {},

    addMessage: (chatId, message) => {
      const messagesKey = chatMessageOptions(chatId).queryKey;

      queryClient.setQueryData(messagesKey, (oldMessages = []) => {
        return [...oldMessages, message];
      });
    },

    addMembers: (chatId, members) => {
      queryClient.setQueryData(
        converationOptions().queryKey,
        (conversation = {}) => {
          const prevConversation = conversation[chatId] || {};
          const participants = prevConversation?.participants ?? [];

          return {
            ...conversation,
            [chatId]: {
              ...prevConversation,
              participants: [...participants, ...members],
            },
          };
        }
      );
    },

    removeMembers: (chatId, members) => {
      queryClient.setQueryData(
        converationOptions().queryKey,
        (conversation = {}) => {
          const prevConversation = conversation[chatId] || {};
          const participants = prevConversation?.participants ?? [];

          const memberIdSet = new Set(members);
          return {
            ...conversation,
            [chatId]: {
              ...prevConversation,
              participants: participants.filter(
                ({ id }) => !memberIdSet.has(id)
              ),
            },
          };
        }
      );
    },

    updateMessageStatus: (chatId, messageId, status) => {
      const messagesKey = chatMessageOptions(chatId).queryKey;

      queryClient.setQueryData(messagesKey, (oldMessages = []) => {
        return oldMessages.map((message) =>
          message.id === messageId ? { ...message, status } : message
        );
      });
    },

    updateMessageId: (chatId, tempId, newId) => {
      const messagesKey = chatMessageOptions(chatId).queryKey;

      queryClient.setQueryData(messagesKey, (oldMessages = []) => {
        return oldMessages.map((message) =>
          message.id === tempId ? { ...message, id: newId } : message
        );
      });
    },

    updateTypingStatus: (chatId, userId, isTyping) => {
      set(() => ({
        typingStatus: {
          [`${chatId}:${userId}`]: isTyping,
        },
      }));
    },

    updateUserPresence: (userId, status, lastSeen) => {
      set((state) => ({
        userPresence: {
          ...state.userPresence,
          [userId]: {
            status,
            lastSeen,
          },
        },
      }));
    },
  }))
);

// Export the store with auto-generated selectors
export const useChatStore = createSelectors(useChatStoreBase);

export const useUserPresence = (userId: string) =>
  useChatStore.use.userPresence()[userId];

export const useConversations = () => {
  const { data } = useQuery({ ...converationOptions(), enabled: false });
  return data;
};

export const useChat = (chatId: string) => {
  const { data } = useQuery({ ...chatMessageOptions(chatId), enabled: false });
  return data;
};

export const useTypingStatus = (chatId: string, userId: string) => {
  const isTyping: boolean | undefined =
    useChatStore.use.typingStatus()[`${chatId}:${userId}`];

  return isTyping ?? false;
};

// Action selectors
export const useChatActions = () => ({
  addMessage: useChatStore.use.addMessage(),
  addMembers: useChatStore.use.addMembers(),
  removeMembers: useChatStore.use.removeMembers(),
  updateMessageStatus: useChatStore.use.updateMessageStatus(),
  updateTypingStatus: useChatStore.use.updateTypingStatus(),
  updateMessageId: useChatStore.use.updateMessageId(),
});

export const useUserActions = () => ({
  updateUserPresence: useChatStore.use.updateUserPresence(),
});
