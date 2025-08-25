export type MessageStatus =
  | "SENDING"
  | "SENT"
  | "DELIVERED"
  | "READ"
  | "FAILED";

export type UserPresence = "online" | "offline" | "away";

export interface IParticipant {
  id: string;
  username: string;
  avatarUrl: string | null;
  role: "admin" | "member";
}

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
  participants: IParticipant[];
}

export interface IGroupConversation {
  type: "group";
  name: string;
  description: string | null;
  avatarUrl: string | null;
  inviteLink: string | null;
}

export type Conversation = IConversationBase &
  (
    | {
        type: "direct";
      }
    | IGroupConversation
  );

export interface IChatState {
  userPresence: {
    [userId: string]: {
      status: UserPresence;
      lastSeen: string;
    } | null;
  };
  typingStatus: {
    [id: string]: boolean;
  };
}

export interface IChatActions {
  // State setters
  addMessage: (chatId: string, message: Message) => void;
  addMembers: (chatId: string, members: IParticipant[]) => void;
  removeMembers: (chatId: string, members: string[]) => void;
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
  updateUserPresence: (
    userId: string,
    status: UserPresence,
    lastSeen: string
  ) => void;

  // // Utility
  // clearChat: () => void;
}
