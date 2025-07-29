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
        receiverId: string;
        type: "direct";
      }
    | {
        type: "group";
      }
  );

export interface IConversationBase {
  id: string;
  unread: number;
  lastMessage: string;
  timestamp: Date | null;
  participants: { id: string; username: string; avatarUrl: string }[];
}

export type Conversation = IConversationBase &
  (
    | {
        type: "direct";
      }
    | {
        type: "group";
        name: string;
        avatarUrl: string;
      }
  );

export interface ChatState {
  conversation: { [id: string]: Conversation };
  chat: { [chatId: string]: Message[] };
  isCoversationLoading: boolean;
  isChatMessagesLoading: boolean;
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

export interface ChatContextType extends ChatState {
  socketConnectionStatus: SocketConnectionStatus;
  sendMessage: (
    chatId: string,
    content: string,
    senderId: string,
    receiverId: string
  ) => void;
  receiveMessage: (chatId: string, message: Message) => void;
  fetchConversations: () => Promise<void>;
  fetchMessages: (chatId: string) => Promise<void>;
}

export interface ClientToServerEvents {
  send_message: (chatId: string, message: Message) => void;
}

export interface ServerToClientEvents {
  receive_message: (chatId: string, message: Message) => void;
}
