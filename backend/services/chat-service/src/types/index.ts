import { Server, Socket } from "socket.io";

export type IOServer = InstanceType<
  typeof Server<ClientToServerEvents, ServerToClientEvents>
>;
export type IOSocket = InstanceType<
  typeof Socket<ClientToServerEvents, ServerToClientEvents>
>;

export interface IMessage {
  id: string;
  content: string;
  senderId: string;
  receiverId: string;
  type: "direct" | "group";
  timestamp: Date;
}

export interface ServerToClientEvents {
  receive_message: (chatId: string, message: IMessage, ack: () => void) => void;
  message_status: (
    chatId: string,
    messageId: string,
    status: "DELIVERED" | "READ"
  ) => void;
  user_typing: (chatId: string, userId: string, isTying: boolean) => void;
}

export interface ClientToServerEvents {
  send_message: (
    chatId: string,
    message: IMessage,
    ack: (arg: { tempId: string; newId: string }) => {}
  ) => void;
  message_status: (
    senderId: string,
    chatId: string,
    messageId: string,
    status: "READ"
  ) => void;
  user_typing: (chatId: string, userId: string, isTying: boolean) => void;
  join_group: (
    groupId: string,
    ack: (arg: { ok: false; error: string } | { ok: true }) => {}
  ) => void;
  leave_group: (
    groupId: string,
    ack: (arg: { ok: false; error: string } | { ok: true }) => {}
  ) => void;
}
