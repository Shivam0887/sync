export interface IMessage {
  id: string;
  content: string;
  senderId: string;
  receiverId: string;
  timestamp: Date;
}

export interface ServerToClientEvents {
  send_message: (chatId: string, message: IMessage) => void;
}

export interface ClientToServerEvents {
  receive_message: (chatId: string, message: IMessage) => void;
}
