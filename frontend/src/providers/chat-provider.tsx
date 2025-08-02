import type {
  ChatAction,
  ChatContextType,
  IChatState,
  ISendMsgArgs,
  Message,
  SocketConnectionStatus,
} from "@/types/chat.types";

import React, {
  useContext,
  createContext,
  useReducer,
  useEffect,
  useMemo,
  useCallback,
  useState,
} from "react";

import { socket } from "@/lib/socket";
import { toastErrorHandler } from "@/lib/utils";
import { useAuth } from "./auth-provider";
import { nanoid } from "nanoid";
import type { Socket } from "socket.io-client";

const initialState: IChatState = {
  conversation: {},
  chat: {},
  isChatMessagesLoading: false,
  isCoversationLoading: false,
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

function chatReducer(state: IChatState, action: ChatAction): IChatState {
  switch (action.type) {
    case "SET_CONVERSATIONS":
      const conversations = action.payload.reduce((result, conversation) => {
        result[conversation.id] = conversation;
        return result;
      }, {} as IChatState["conversation"]);

      return { ...state, conversation: { ...conversations } };
    case "SET_CHAT":
      return {
        ...state,
        chat: {
          ...state.chat,
          [action.payload.chatId]: action.payload.messages,
        },
      };
    case "ADD_MESSAGE": {
      const { chatId, message } = action.payload;
      const prev = state.chat[chatId] || [];
      return {
        ...state,
        chat: { ...state.chat, [chatId]: [...prev, message] },
      };
    }
    case "SET_LOADING":
      const isLoading = action.payload.isLoading;
      return {
        ...state,
        ...(action.payload.loadType === "conversation"
          ? { isCoversationLoading: isLoading }
          : { isChatMessagesLoading: isLoading }),
      };
    default:
      return state;
  }
}

export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
};

const ChatProvider = ({ children }: React.PropsWithChildren) => {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const [socketConnectionStatus, setSocketConnectionStatus] =
    useState<SocketConnectionStatus>("disconnected");

  const { apiRequest } = useAuth();

  // Fetch conversations from API
  const fetchConversations = useCallback(async () => {
    dispatch({
      type: "SET_LOADING",
      payload: { loadType: "conversation", isLoading: true },
    });

    try {
      const res = await apiRequest("/chat/conversations");

      if (!res.ok) throw new Error("Failed to fetch conversations");

      const data = await res.json();
      dispatch({ type: "SET_CONVERSATIONS", payload: data.conversations });
    } catch (error) {
      toastErrorHandler({ error });
    } finally {
      dispatch({
        type: "SET_LOADING",
        payload: { loadType: "conversation", isLoading: false },
      });
    }
  }, [apiRequest]);

  // Fetch messages for a chat
  const fetchMessages = useCallback(
    async (chatId: string) => {
      dispatch({
        type: "SET_LOADING",
        payload: { loadType: "messages", isLoading: true },
      });
      try {
        const res = await apiRequest(`/chat/${chatId}/messages`);
        if (!res.ok) throw new Error("Failed to fetch messages");
        const data = await res.json();
        dispatch({
          type: "SET_CHAT",
          payload: { chatId, messages: data.messages },
        });
      } catch (error) {
        toastErrorHandler({ error });
      } finally {
        dispatch({
          type: "SET_LOADING",
          payload: { loadType: "messages", isLoading: false },
        });
      }
    },
    [apiRequest]
  );

  const sendMessage = useCallback(
    async ({
      chatId,
      content,
      conversationType,
      receiverId,
      senderId,
    }: ISendMsgArgs) => {
      const timestamp = new Date();

      try {
        let message: Partial<Message> = {
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

        dispatch({
          type: "ADD_MESSAGE",
          payload: { chatId, message: message as Message },
        });
        // Optionally, refetch conversations to update last message
        fetchConversations();
      } catch (error) {
        toastErrorHandler({ error });
      }
    },
    [apiRequest, fetchConversations]
  );

  // Receive a message (from socket)
  const receiveMessage = useCallback((chatId: string, message: Message) => {
    dispatch({ type: "ADD_MESSAGE", payload: { chatId, message } });
  }, []);

  useEffect(() => {
    (async () => {
      await fetchConversations();
    })();

    // socket.connect();

    const onConnect = () => {
      setSocketConnectionStatus("connected");
    };

    const onDisconnect = (reason: Socket.DisconnectReason) => {
      setSocketConnectionStatus("disconnected");
      console.log(reason);
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

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    socket.io.on("reconnect_attempt", onReconnecting);
    socket.io.on("reconnect", onConnect);

    socket.on("receive_message", handleReceiveMessage);

    return () => {
      // socket.disconnect();

      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);

      socket.io.off("reconnect_attempt", onReconnecting);
      socket.io.off("reconnect", onConnect);

      socket.off("receive_message", handleReceiveMessage);
    };
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      socketConnectionStatus,
      sendMessage,
      receiveMessage,
      fetchConversations,
      fetchMessages,
    }),
    [state, sendMessage, receiveMessage, fetchConversations, fetchMessages]
  );

  return <ChatContext value={value}>{children}</ChatContext>;
};

export default ChatProvider;
