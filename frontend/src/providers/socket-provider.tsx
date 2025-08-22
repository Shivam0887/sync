import type { Message } from "@/types/chat.types";

import { type ExtendedConnectError, createSocket } from "@/lib/socket";
import { toastErrorHandler } from "@/lib/utils";
import { refreshAccessToken } from "@/services/api-request";
import { useUser } from "@/stores/auth-store";
import { useChatActions, useUserActions } from "@/stores/chat-store";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useMemo,
  useState,
} from "react";
import type {
  IOSocket,
  ServerToClientEvents,
  SocketConnectionStatus,
} from "@/types/socket.types";

interface SocketState {
  status: SocketConnectionStatus;
  socket: IOSocket | null;
}

interface SocketActions {
  onMessageSend: (chatId: string, message: Message) => Promise<void>;
  onMessageRead: (chatId: string, senderId: string, messageId: string) => void;
  onUserTyping: (chatId: string, userId: string, isTyping: boolean) => void;
}

const SocketStateContext = createContext<SocketState | undefined>(undefined);
const SocketActionsContext = createContext<SocketActions | undefined>(
  undefined
);

// Custom hook for accessing socket state
const useSocketState = () => {
  const context = useContext(SocketStateContext);
  if (!context) {
    throw new Error("useSocketState must be used within SocketProvider");
  }
  return context;
};

// Custom hook for accessing socket actions
const useSocketActions = () => {
  const context = useContext(SocketActionsContext);
  if (!context) {
    throw new Error("useSocketActions must be used within SocketProvider");
  }
  return context;
};

// Main hook that combines both state and actions
const useSocket = () => {
  return {
    ...useSocketState(),
    ...useSocketActions(),
  };
};

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socketState, setSocketState] = useState<{
    status: SocketConnectionStatus;
  }>({ status: "disconnected" });
  const [accessToken, setAccessToken] = useState(
    localStorage.getItem("accessToken")
  );

  const socketRef = useRef<IOSocket | null>(null);

  const {
    addMessage,
    updateMessageStatus,
    updateMessageId,
    updateTypingStatus,
  } = useChatActions();
  const { updateUserPresence } = useUserActions();

  const user = useUser();

  // Memoized socket actions
  const actions = useMemo<SocketActions>(
    () => ({
      onMessageSend: async (chatId, message) => {
        const socket = socketRef.current;
        if (!socket?.connected) {
          toastErrorHandler({
            defaultErrorMsg: "Not connected. Please check your connection.",
          });
          return;
        }

        socket
          .timeout(3000)
          .emit("send_message", chatId, message, (err, { newId, tempId }) => {
            if (err) {
              console.log("[send_message] ack error:", err.message);
            } else {
              updateMessageId(chatId, tempId, newId);
              updateMessageStatus(chatId, newId, "SENT");
            }
          });

        addMessage(chatId, message);
      },

      onMessageRead: (chatId, senderId, messageId) => {
        const socket = socketRef.current;
        if (socket) {
          socket.emit("message_status", senderId, chatId, messageId, "READ");
        }
      },

      onUserTyping: (chatId, userId, isTyping) => {
        if (socketRef.current) {
          socketRef.current.emit("user_typing", chatId, userId, isTyping);
        }
      },
    }),
    [addMessage, updateMessageStatus, updateMessageId]
  );

  // Socket connection and event handling
  useEffect(() => {
    const socket = createSocket(accessToken);
    const userId = user?.id;
    socketRef.current = socket;

    if (!userId) {
      if (socket.connected) socket.disconnect();
      return;
    }

    const onConnect = () => {
      setSocketState({ status: "connected" });
    };

    const onDisconnect = () => {
      setSocketState({ status: "disconnected" });
    };

    const onReconnecting = (attempts: number) => {
      console.log("[Reconnect attempts]:", attempts);
      setSocketState({ status: "reconnecting" });
    };

    const onReconnected = () => {
      console.log(["Reconnnected"]);
      setSocketState({ status: "connected" });
    };

    const onConnectError = async (err: ExtendedConnectError) => {
      setSocketState({ status: "disconnected" });
      const errorCode = Number(err.description);

      if (!isNaN(errorCode) && errorCode === 401) {
        try {
          const { newAccessToken } = await refreshAccessToken();
          setAccessToken(newAccessToken);
        } catch (refreshError) {
          toastErrorHandler({ error: refreshError });
        }
      }
    };

    const onMessageReceive: ServerToClientEvents["receive_message"] = (
      chatId,
      message,
      cb
    ) => {
      try {
        addMessage(chatId, message);
        cb();
        updateMessageStatus(chatId, message.id, "DELIVERED");
      } catch (error) {
        console.error("Error processing received message:", error);
        cb();
      }
    };

    socket.auth = { userId };
    socket.connect();

    // Event listeners
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.io.on("reconnect_attempt", onReconnecting);
    socket.io.on("reconnect", onReconnected);
    socket.on("receive_message", onMessageReceive);
    socket.on("message_status", updateMessageStatus);
    socket.on("user_typing", updateTypingStatus);
    socket.on("presence_updates", updateUserPresence);

    return () => {
      socket.auth = {};
      socket.disconnect();
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.io.off("reconnect_attempt", onReconnecting);
      socket.io.off("reconnect", onReconnected);
      socket.off("receive_message", onMessageReceive);
      socket.off("message_status", updateMessageStatus);
      socket.off("user_typing", updateTypingStatus);
      socket.off("presence_updates", updateUserPresence);
    };
  }, [
    user?.id,
    accessToken,
    addMessage,
    updateMessageStatus,
    updateTypingStatus,
    updateUserPresence,
  ]);

  const state = useMemo(
    () => ({
      status: socketState.status,
      socket: socketRef.current,
    }),
    [socketState.status]
  );

  return (
    <SocketStateContext.Provider value={state}>
      <SocketActionsContext.Provider value={actions}>
        {children}
      </SocketActionsContext.Provider>
    </SocketStateContext.Provider>
  );
};

export { useSocket, useSocketState, useSocketActions };
