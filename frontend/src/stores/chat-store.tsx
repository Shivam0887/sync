import type {
  IChatState,
  ISendMsgArgs,
  Message,
  SocketConnectionStatus,
  IChatActions,
} from "@/types/chat.types";
import type { Socket } from "socket.io-client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { socket } from "@/lib/socket";
import { createSelectors, toastErrorHandler } from "@/lib/utils";
import { useAuthStore } from "./auth-store";
import { nanoid } from "nanoid";
import { apiRequest } from "@/services/api-request";

const useChatStoreBase = create<IChatState & IChatActions>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    conversation: {},
    chat: {},
    isChatMessagesLoading: false,
    isCoversationLoading: false,
    socketConnectionStatus: "disconnected" as SocketConnectionStatus,

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

    setLoading: (loadType, isLoading) => {
      set((state) => ({
        ...state,
        ...(loadType === "conversation"
          ? { isCoversationLoading: isLoading }
          : { isChatMessagesLoading: isLoading }),
      }));
    },

    setSocketConnectionStatus: (status) => {
      set({ socketConnectionStatus: status });
    },

    clearChat: () => {
      set({
        conversation: {},
        chat: {},
        isChatMessagesLoading: false,
        isCoversationLoading: false,
        socketConnectionStatus: "disconnected",
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

    sendMessage: async ({
      chatId,
      content,
      conversationType,
      receiverId,
      senderId,
    }: ISendMsgArgs) => {
      const { addMessage } = get();
      const timestamp = new Date();

      try {
        const message: Partial<Message> = {
          content,
          id: nanoid(),
          senderId,
          timestamp,
          status: "SENT",
          type: conversationType,
        };

        if (message.type === "direct" && receiverId) {
          message.receiverId = receiverId;
        }

        socket.emit("send_message", chatId, {
          content,
          senderId,
          type: conversationType,
          timestamp,
        });

        addMessage(chatId, message as Message);
      } catch (error) {
        toastErrorHandler({ error });
      }
    },

    receiveMessage: (chatId: string, message: Message) => {
      const { addMessage } = get();
      addMessage(chatId, message);
    },

    // Socket management
    initializeSocket: () => {
      const { setSocketConnectionStatus, receiveMessage, fetchConversations } =
        get();

      // Initialize conversations
      fetchConversations();

      const onConnect = () => {
        setSocketConnectionStatus("connected");
      };

      const onDisconnect = (reason: Socket.DisconnectReason) => {
        setSocketConnectionStatus("disconnected");
        console.log("Socket disconnected:", reason);
      };

      const onReconnecting = () => {
        setSocketConnectionStatus("reconnecting");
      };

      const onConnectError = (err: Error) => {
        setSocketConnectionStatus("disconnected");
        toastErrorHandler({ error: err });
      };

      const handleReceiveMessage = (chatId: string, message: Message) => {
        receiveMessage(chatId, message);
      };

      socket.connect();
      // Add event listeners
      socket.on("connect", onConnect);
      socket.on("disconnect", onDisconnect);
      socket.on("connect_error", onConnectError);
      socket.io.on("reconnect_attempt", onReconnecting);
      socket.io.on("reconnect", onConnect);
      socket.on("receive_message", handleReceiveMessage);

      // Store cleanup function for later use
      (get() as any)._socketCleanup = () => {
        socket.disconnect();
        socket.off("connect", onConnect);
        socket.off("disconnect", onDisconnect);
        socket.off("connect_error", onConnectError);
        socket.io.off("reconnect_attempt", onReconnecting);
        socket.io.off("reconnect", onConnect);
        socket.off("receive_message", handleReceiveMessage);
      };
    },

    cleanupSocket: () => {
      const cleanup = (get() as any)._socketCleanup;
      if (cleanup) {
        cleanup();
      }
    },
  }))
);

// Export the store with auto-generated selectors
export const useChatStore = createSelectors(useChatStoreBase);

export const useConversations = () => useChatStore.use.conversation();

export const useChat = (chatId: string) => useChatStore.use.chat()[chatId];

export const useChatLoading = () => ({
  isChatMessagesLoading: useChatStore.use.isChatMessagesLoading(),
  isCoversationLoading: useChatStore.use.isCoversationLoading(),
});

export const useSocket = () => ({
  socketConnectionStatus: useChatStore.use.socketConnectionStatus(),
  initializeSocket: useChatStore.use.initializeSocket(),
  cleanupSocket: useChatStore.use.cleanupSocket(),
});

// Action selectors
export const useChatActions = () => ({
  fetchConversations: useChatStore.use.fetchConversations(),
  fetchMessages: useChatStore.use.fetchMessages(),
  sendMessage: useChatStore.use.sendMessage(),
  receiveMessage: useChatStore.use.receiveMessage(),
  clearChat: useChatStore.use.clearChat(),
});

// Subscribe to auth changes to handle cleanup on logout
useChatStore.subscribe(
  () => useAuthStore.getState().isAuthenticated,
  (isAuthenticated) => {
    if (!isAuthenticated) {
      useChatStore.getState().cleanupSocket();
    }
  }
);
