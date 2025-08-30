import type { Socket } from "socket.io-client";
import type { Message } from "./chat.types";

export type SocketConnectionStatus =
  | "connected"
  | "disconnected"
  | "reconnecting";

export interface ClientToServerEvents {
  send_message: (args: {
    chatId: string;
    message: Omit<Message, "status">;
    conversationType: "direct" | "group";
    ack: (error: Error, msg: { tempId: string; newId: string }) => void;
  }) => void;
  message_status: (args: {
    senderId: string;
    chatId: string;
    messageId: string;
    status: "READ";
  }) => void;
  user_typing: (args: {
    chatId: string;
    userId: string;
    isTyping: boolean;
  }) => void;
  join_group: (args: { groupIds: string[]; userIds: string[] }) => void;
  leave_group: (args: { groupId: string; userId: string }) => void;
}

export interface ServerToClientEvents {
  receive_message: (args: {
    chatId: string;
    message: Message;
    ack: () => void;
  }) => void;
  message_status: (args: {
    chatId: string;
    messageId: string;
    status: "DELIVERED" | "READ";
  }) => void;
  user_typing: (args: {
    chatId: string;
    userId: string;
    isTyping: boolean;
  }) => void;
  presence_updates: (args: {
    userId: string;
    status: "online" | "offline" | "away";
    lastSeen: string;
  }) => void;
  error: (error: string, ack: () => void) => void;
}

export type IOSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
