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

export interface Message {
  id: string;
  content: string;
  status: MessageStatus;
  senderId: string;
  isEdited: boolean;
  replyToId: string | null;
  createdAt: Date;
  editedAt: Date | null;
  messageType: "TEXT" | "IMAGE" | "VIDEO" | "VOICE" | "FILE";
  receiverId: string | null;
}

export interface IConversationBase {
  id: string;
  unread: number;
  participants: IParticipant[];
  lastMessage: {
    content: string;
    createdAt: Date;
  } | null;
}

export interface IGroupConversation {
  type: "group";
  name: string;
  description: string | null;
  avatarUrl: string | null;
  inviteLinkToken: string | null;
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
  addMessage: (args: { chatId: string; message: Message }) => void;
  addMembers: (args: { chatId: string; members: IParticipant[] }) => void;
  removeMembers: (args: { chatId: string; members: string[] }) => void;
  updateMessageStatus: (args: {
    chatId: string;
    messageId: string;
    status: MessageStatus;
  }) => void;
  updateMessageId: (args: {
    chatId: string;
    tempId: string;
    newId: string;
  }) => void;
  updateTypingStatus: (args: {
    chatId: string;
    userId: string;
    isTyping: boolean;
  }) => void;
  updateUserPresence: (args: {
    userId: string;
    status: UserPresence;
    lastSeen: string;
  }) => void;
}
