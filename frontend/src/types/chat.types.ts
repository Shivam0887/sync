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
  typingStatus: {
    [chatId: string]: { [userId: string]: boolean };
  };
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
  updateTypingStatus: (
    chatId: string,
    userId: string,
    isTyping: boolean
  ) => void;
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
