export interface IMessage {
  id: string;
  content: string;
  senderId: string;
  receiverId: string;
  timestamp: Date;
}

export interface ServerToClientEvents {
  receive_message: (chatId: string, message: IMessage) => void;
}

export interface ClientToServerEvents {
  send_message: (chatId: string, message: IMessage) => void;
}
