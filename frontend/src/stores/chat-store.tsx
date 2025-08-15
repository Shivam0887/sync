import type { IChatState, IChatActions } from "@/types/chat.types";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { createSelectors, toastErrorHandler } from "@/lib/utils";
import { apiRequest } from "@/services/api-request";

const useChatStoreBase = create<IChatState & IChatActions>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    conversation: {},
    chat: {},
    typingStatus: {},
    isChatMessagesLoading: false,
    isCoversationLoading: false,

    // State setters
    setConversations: (conversations) => {
      const conversationMap = conversations.reduce((result, conversation) => {
        result[conversation.id] = conversation;
        return result;
      }, {} as IChatState["conversation"]);

      set({ conversation: conversationMap });
    },

    setChat: (chatId, messages) => {
      set((state) => ({
        chat: {
          ...state.chat,
          [chatId]: messages,
        },
      }));
    },

    addMessage: (chatId, message) => {
      set((state) => {
        const prevMessages = state.chat[chatId] || [];
        return {
          chat: {
            ...state.chat,
            [chatId]: [...prevMessages, message],
          },
        };
      });
    },

    updateMessageStatus: (chatId, messageId, status) => {
      set((state) => {
        const messages = state.chat[chatId] || [];
        return {
          chat: {
            ...state.chat,
            [chatId]: messages.map((message) => {
              if (message.id === messageId) message.status = status;
              return message;
            }),
          },
        };
      });
    },

    updateMessageId: (chatId, tempId, newId) => {
      set((state) => {
        const messages = state.chat[chatId] || [];
        return {
          chat: {
            ...state.chat,
            [chatId]: messages.map((message) => {
              if (message.id === tempId) message.id = newId;

              return message;
            }),
          },
        };
      });
    },

    updateTypingStatus: (chatId, userId, isTyping) => {
      set(() => ({
        typingStatus: {
          [chatId]: {
            [userId]: isTyping,
          },
        },
      }));
    },

    setLoading: (loadType, isLoading) => {
      set((state) => ({
        ...state,
        ...(loadType === "conversation"
          ? { isCoversationLoading: isLoading }
          : { isChatMessagesLoading: isLoading }),
      }));
    },

    clearChat: () => {
      set({
        conversation: {},
        chat: {},
        isChatMessagesLoading: false,
        isCoversationLoading: false,
      });
    },

    // API actions
    fetchConversations: async () => {
      const { setLoading, setConversations } = get();
      setLoading("conversation", true);

      try {
        const res = await apiRequest("/chat/conversations");

        if (!res.ok) throw new Error("Failed to fetch conversations");

        const data = await res.json();
        setConversations(data.conversations);
      } catch (error) {
        toastErrorHandler({ error });
      } finally {
        setLoading("conversation", false);
      }
    },

    fetchMessages: async (chatId: string) => {
      const { setLoading, setChat } = get();
      setLoading("messages", true);

      try {
        const res = await apiRequest(`/chat/${chatId}/messages`);

        if (!res.ok) throw new Error("Failed to fetch messages");

        const data = await res.json();
        setChat(chatId, data.messages);
      } catch (error) {
        toastErrorHandler({ error });
      } finally {
        setLoading("messages", false);
      }
    },
  }))
);

// Export the store with auto-generated selectors
export const useChatStore = createSelectors(useChatStoreBase);

export const useConversations = () => useChatStore.use.conversation();

export const useTypingStatus = (chatId: string, userId: string) => {
  const isTyping: boolean | undefined =
    useChatStore.use.typingStatus()[chatId]?.[userId];

  return isTyping ?? false;
};

export const useChat = (chatId: string) => useChatStore.use.chat()[chatId];

export const useChatLoading = () => ({
  isChatMessagesLoading: useChatStore.use.isChatMessagesLoading(),
  isCoversationLoading: useChatStore.use.isCoversationLoading(),
});

// Action selectors
export const useChatActions = () => ({
  fetchConversations: useChatStore.use.fetchConversations(),
  fetchMessages: useChatStore.use.fetchMessages(),
  addMessage: useChatStore.use.addMessage(),
  updateMessageStatus: useChatStore.use.updateMessageStatus(),
  updateTypingStatus: useChatStore.use.updateTypingStatus(),
  updateMessageId: useChatStore.use.updateMessageId(),
  clearChat: useChatStore.use.clearChat(),
});
