import type { Socket } from "socket.io-client";
import type { Message } from "./chat.types";

export type SocketConnectionStatus =
  | "connected"
  | "disconnected"
  | "reconnecting";

export interface ClientToServerEvents {
  send_message: (
    chatId: string,
    message: Omit<Message, "status">,
    cb: (msg: { tempId: string; newId: string }) => void
  ) => void;
  message_status: (
    senderId: string,
    chatId: string,
    messageId: string,
    status: "READ"
  ) => void;

  user_typing: (chatId: string, userId: string, isTying: boolean) => void;
  join_group: (groupIds: string[], userIds: string[]) => void;
  leave_group: (groupId: string, userId: string) => void;
}

export interface ServerToClientEvents {
  receive_message: (chatId: string, message: Message, cb: () => void) => void;
  message_status: (
    chatId: string,
    messageId: string,
    status: "DELIVERED" | "READ"
  ) => void;
  user_typing: (chatId: string, userId: string, isTying: boolean) => void;
  presence_updates: (
    userId: string,
    status: "online" | "offline" | "away",
    lastSeen: string
  ) => void;
}

export type IOSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
