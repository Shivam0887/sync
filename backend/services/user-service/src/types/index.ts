export interface IChat {
  id: string;
  type: "direct" | "group";
  participants: { id: string; username: string }[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IMessage {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  timestamp: Date;
}

export interface IUser {
  id: string;
  username: string;
  avatarUrl: string | null;
}
