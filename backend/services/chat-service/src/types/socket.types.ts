import { z } from "zod/v4-mini";
import { Server, Socket } from "socket.io";

import {
  joinGroupSchema,
  leaveGroupSchema,
  messageStatusSchema,
  messageDataSchema,
  userTypingSchema,
} from "@/lib/zod-schemas/socket-data.schema.js";

export type IOServer = InstanceType<typeof Server<ClientToServerEvents, ServerToClientEvents>>;
export type IOSocket = InstanceType<typeof Socket<ClientToServerEvents, ServerToClientEvents>>;

export type TMessageData = z.infer<typeof messageDataSchema>;

export type TMessageStatus = z.infer<typeof messageStatusSchema>;
export type TUserTyping = z.infer<typeof userTypingSchema>;

export type TJoinGroup = z.infer<typeof joinGroupSchema>;
export type TLeaveGroup = z.infer<typeof leaveGroupSchema>;

export type TUserPresence = {
  userId: string;
  status: "online" | "away" | "offline";
  lastSeen: string;
};

export interface ServerToClientEvents {
  receive_message: (
    data: Omit<TMessageData, "conversationType">,
    ack: () => void
  ) => void;
  message_status: (
    data: Pick<TMessageStatus, "chatId" | "messageId" | "status">
  ) => void;
  user_typing: (data: TUserTyping) => void;
  presence_updates: (data: TUserPresence) => void;
  error: (error: string, ack?: () => void) => void;
}

export interface ClientToServerEvents {
  send_message: (
    data: unknown,
    ack: (ackData: { tempId: string; newId: string }) => void
  ) => void;
  message_status: (data: unknown) => void;
  user_typing: (data: unknown) => void;
  join_group: (data: unknown) => void;
  leave_group: (data: unknown) => void;
}
