import type {
  IOSocket,
  Message,
  ServerToClientEvents,
  SocketConnectionStatus,
} from "@/types/chat.types";
import type { Socket } from "socket.io-client";

import { type ExtendedConnectError, createSocket } from "@/lib/socket";
import { toastErrorHandler } from "@/lib/utils";
import { refreshAccessToken } from "@/services/api-request";
import { useUser } from "@/stores/auth-store";
import { useChatActions } from "@/stores/chat-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

interface SocketContextState {
  socketConnectionStatus: SocketConnectionStatus;
  sendMessage: (chatId: string, message: Message) => Promise<void>;
  onMessageRead: (senderId: string, chatId: string, messageId: string) => void;
}

const SocketContext = createContext<SocketContextState | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error("useSocket must be used within SocketProvider");
  }

  return context;
};

export const SocketProvider = ({ children }: { children: React.ReactNode }) => {
  const [socketConnectionStatus, setSocketConnectionStatus] =
    useState<SocketConnectionStatus>("disconnected");
  const [accessToken, setAccessToken] = useState(
    localStorage.getItem("accessToken")
  );

  const socketRef = useRef<IOSocket | null>(null);

  const { addMessage, updateMessageStatus, updateMessageId } = useChatActions();

  const user = useUser();

  const sendMessage = useCallback(
    async (chatId: string, message: Message): Promise<void> => {
      const socket = socketRef.current;

      // Check if socket is connected
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
    [addMessage, updateMessageStatus, updateMessageId]
  );

  const onMessageRead = useCallback(
    (senderId: string, chatId: string, messageId: string) => {
      const socket = socketRef.current;

      if (socket) {
        socket.emit("message_status", senderId, chatId, messageId, "READ");
        updateMessageStatus(chatId, messageId, "DELIVERED");
      }
    },
    [updateMessageStatus]
  );

  useEffect(() => {
    const socket = createSocket(accessToken);
    const userId = user?.id;

    socketRef.current = socket;

    // Don't connect if no user
    if (!userId) {
      if (socket.connected) {
        socket.disconnect();
      }
      return;
    }

    const onConnect = () => {
      setSocketConnectionStatus("connected");
    };

    const onDisconnect = (reason: Socket.DisconnectReason) => {
      console.log("Disconnected:", reason);
      setSocketConnectionStatus("disconnected");
    };

    const onReconnecting = (attemptNumber: number) => {
      console.log(`Reconnecting attempt ${attemptNumber}`);
      setSocketConnectionStatus("reconnecting");
    };

    const onReconnected = () => {
      console.log("Reconnected");
      setSocketConnectionStatus("connected");
    };

    const onConnectError = async (err: ExtendedConnectError) => {
      console.error("Socket connection error:", err);
      setSocketConnectionStatus("disconnected");

      const errorCode = Number(err.description);

      if (!isNaN(errorCode)) {
        switch (errorCode) {
          case 401:
            // Token expired or invalid
            try {
              const { newAccessToken } = await refreshAccessToken();
              setAccessToken(newAccessToken);
            } catch (refreshError) {
              toastErrorHandler({ error: refreshError });
            }
            break;

          case 403:
            toastErrorHandler({
              error: new Error(
                "Access forbidden. Please check your permissions."
              ),
            });
            break;

          case 503:
            toastErrorHandler({
              error: new Error("Service temporarily unavailable"),
            });
            break;

          default:
            toastErrorHandler({ error: err });
        }
      } else {
        // Network error or other issues
        console.log("Network error, retrying connection...");
      }
    };

    const onMessageStatusChange: ServerToClientEvents["message_status"] = (
      chatId,
      messageId,
      status
    ) => {
      updateMessageStatus(chatId, messageId, status);
    };

    const onMessageReceive: ServerToClientEvents["receive_message"] = (
      chatId,
      message,
      cb
    ) => {
      try {
        addMessage(chatId, message);
        cb(); // Acknowledgement to the server
      } catch (error) {
        console.error("Error processing received message:", error);
        // Still acknowledge to prevent server retries
        cb();
      }
    };

    // Set authentication with user ID (token is in headers)
    socket.auth = {
      userId: userId,
    };

    // Connect socket
    socket.connect();

    // Add event listeners
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);

    socket.io.on("reconnect_attempt", onReconnecting);
    socket.io.on("reconnect", onReconnected);

    socket.on("receive_message", onMessageReceive);
    socket.on("message_status", onMessageStatusChange);

    return () => {
      // Clear auth
      socket.auth = {};

      // Disconnect and remove listeners
      socket.disconnect();
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);

      socket.io.off("reconnect_attempt", onReconnecting);
      socket.io.off("reconnect", onReconnected);

      socket.off("receive_message", onMessageReceive);
      socket.off("message_status", onMessageStatusChange);
    };
  }, [addMessage, user?.id, accessToken, updateMessageStatus]); // Fixed dependencies

  const value = useMemo(
    () => ({ socketConnectionStatus, sendMessage, onMessageRead }),
    [socketConnectionStatus, sendMessage, onMessageRead]
  );

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};
