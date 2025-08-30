import { Server, Socket } from "socket.io";
import { IMessage } from "./chat.types.js";

export type IOServer = InstanceType<
  typeof Server<ClientToServerEvents, ServerToClientEvents>
>;
export type IOSocket = InstanceType<
  typeof Socket<ClientToServerEvents, ServerToClientEvents>
>;

export interface IParticipant {
  id: string;
  username: string;
  avatarUrl: string | null;
  role: string;
}

export interface ServerToClientEvents {
  receive_message: (args: {
    chatId: string;
    message: IMessage;
    ack: (error: Error) => void;
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
    status: "online" | "away" | "offline";
    lastSeen: string;
  }) => void;
  error: (error: string, ack: () => void) => void;
}

export interface ClientToServerEvents {
  send_message: (args: {
    chatId: string;
    message: IMessage;
    conversationType: "direct" | "group";
    ack: (arg: { tempId: string; newId: string }) => {};
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
