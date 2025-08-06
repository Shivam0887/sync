type MessageStatus = "SENT" | "DELIVERED" | "READ";

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
  socketConnectionStatus: SocketConnectionStatus;
}

export interface IChatActions {
  // State setters
  setConversations: (conversations: Conversation[]) => void;
  setChat: (chatId: string, messages: Message[]) => void;
  addMessage: (chatId: string, message: Message) => void;
  setLoading: (
    loadType: "conversation" | "messages",
    isLoading: boolean
  ) => void;
  setSocketConnectionStatus: (status: SocketConnectionStatus) => void;

  // API actions
  fetchConversations: () => Promise<void>;
  fetchMessages: (chatId: string) => Promise<void>;
  sendMessage: (args: ISendMsgArgs) => Promise<void>;
  receiveMessage: (chatId: string, message: Message) => void;

  // Socket management
  initializeSocket: () => void;
  cleanupSocket: () => void;

  // Utility
  clearChat: () => void;
}

export interface ISendMsgArgs {
  chatId: string;
  content: string;
  senderId: string;
  receiverId: string | null;
  conversationType: "direct" | "group";
}

export type SocketConnectionStatus =
  | "connected"
  | "disconnected"
  | "reconnecting";

export type ChatAction =
  | { type: "SET_CONVERSATIONS"; payload: Conversation[] }
  | { type: "SET_CHAT"; payload: { chatId: string; messages: Message[] } }
  | { type: "ADD_MESSAGE"; payload: { chatId: string; message: Message } }
  | {
      type: "SET_LOADING";
      payload: { loadType: "messages" | "conversation"; isLoading: boolean };
    };

export interface ChatContextType extends IChatState {
  socketConnectionStatus: SocketConnectionStatus;
  sendMessage: (args: ISendMsgArgs) => void;
  receiveMessage: (chatId: string, message: Message) => void;
  fetchConversations: () => Promise<void>;
  fetchMessages: (chatId: string) => Promise<void>;
}

export interface ClientToServerEvents {
  send_message: (
    chatId: string,
    message: Omit<Message, "id" | "status">
  ) => void;
}

export interface ServerToClientEvents {
  receive_message: (chatId: string, message: Message) => void;
}
