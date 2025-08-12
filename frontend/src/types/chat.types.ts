import type { Socket } from "socket.io-client";

export type MessageStatus =
  | "SENDING"
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "FAILED";

export interface IMessageBase {
  id: string;
  content: string;
  timestamp: Date;
  status: MessageStatus;
  senderId: string;
}

export type Message = IMessageBase &
  (
    | {
        type: "group";
      }
    | {
        type: "direct";
        receiverId: string;
      }
  );

export interface IConversationBase {
  id: string;
  unread: number;
  lastMessage: string;
  timestamp: Date | null;
  participants: {
    id: string;
    username: string;
    avatarUrl: string | null;
    role: "admin" | "member";
  }[];
}

export type Conversation = IConversationBase &
  (
    | {
        type: "direct";
      }
    | {
        type: "group";
        name: string;
        description: string | null;
        avatarUrl: string | null;
        inviteLink: string | null;
      }
  );

export interface IChatState {
  conversation: { [id: string]: Conversation };
  chat: { [chatId: string]: Message[] };
  isCoversationLoading: boolean;
  isChatMessagesLoading: boolean;
}

export interface IChatActions {
  // State setters
  setConversations: (conversations: Conversation[]) => void;
  setChat: (chatId: string, messages: Message[]) => void;
  addMessage: (chatId: string, message: Message) => void;
  updateMessageStatus: (
    chatId: string,
    messageId: string,
    status: MessageStatus
  ) => void;
  updateMessageId: (chatId: string, tempId: string, newId: string) => void;
  setLoading: (
    loadType: "conversation" | "messages",
    isLoading: boolean
  ) => void;

  // API actions
  fetchConversations: () => Promise<void>;
  fetchMessages: (chatId: string) => Promise<void>;

  // Utility
  clearChat: () => void;
}

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
}

export interface ServerToClientEvents {
  receive_message: (chatId: string, message: Message, cb: () => void) => void;
  message_status: (
    chatId: string,
    messageId: string,
    status: "DELIVERED" | "READ"
  ) => void;
}

export type IOSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
