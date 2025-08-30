export interface IMessage {
  id: string;
  content: string;
  senderId: string;
  isEdited: boolean;
  replyToId: string | null;
  createdAt: Date;
  editedAt: Date | null;
  status: string;
  messageType: "TEXT" | "IMAGE" | "VIDEO" | "VOICE" | "FILE";
  receiverId: string | null;
}
