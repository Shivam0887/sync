import z from "zod";

export const messageSchema = z.object({
  id: z.string().nonempty(),
  content: z.string().nonempty(),
  senderId: z.uuid(),
  receiverId: z.uuid().nullable(),
  isEdited: z.boolean(),
  replyToId: z.string().nullable(),
  messageType: z.enum(["TEXT", "IMAGE", "VIDEO", "VOICE", "FILE"]),
  status: z.enum(["SENT", "DELIVERED", "READ"]),
  editedAt: z.date().nullable(),
  createdAt: z.date(),
});

export const messageDataSchema = z.object({
  chatId: z.uuid(),
  conversationType: z.enum(["direct", "group"]),
  message: messageSchema,
});

export const messageStatusSchema = z.object({
  chatId: z.uuid(),
  conversationType: z.enum(["direct", "group"]),
  messageId: z.uuid(),
  senderId: z.uuid(),
  userId: z.uuid(),
  status: z.enum(["DELIVERED", "READ"]),
});

export const userTypingSchema = z.object({
  chatId: z.uuid(),
  userId: z.uuid(),
  isTyping: z.boolean(),
});

export const joinGroupSchema = z.object({
  groupIds: z.array(z.uuid()).nonempty(),
  userIds: z.array(z.uuid()).nonempty(),
});

export const leaveGroupSchema = z.object({
  groupId: z.uuid(),
  userId: z.uuid(),
});
