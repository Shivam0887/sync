import z from "zod";
import { IMessage } from "./chat.types.js";

export const incomingMessageSchema = z.object({
  userId: z.string(),
  chatId: z.string(),
  message: z.custom<IMessage>(),
});

export const userTypingSchems = z.object({
  chatId: z.string(),
  userId: z.string(),
  isTyping: z.boolean(),
});

export const ackSchema = z.object({
  chatId: z.string(),
  userId: z.string(),
  messageId: z.string(),
  status: z.enum(["DELIVERED", "READ"]),
});

export const userPresenceSchema = z.object({
  userId: z.string(),
  status: z.enum(["online", "away", "offline"]),
  lastSeen: z.string(),
});

export const patternSchemas = {
  "user_id:*": incomingMessageSchema,
  "user_id:*:typing": userTypingSchems,
  "group_id:*": incomingMessageSchema.omit({ userId: true }),
  "ack:*": ackSchema,
  presence_updates: userPresenceSchema,
};

export type TIncomingMessage = z.infer<typeof incomingMessageSchema>;
export type TUserTyping = z.infer<typeof userTypingSchems>;
export type TAck = z.infer<typeof ackSchema>;
export type TUserPresence = z.infer<typeof userPresenceSchema>;

export type PatternMap = {
  [K in keyof typeof patternSchemas]: z.infer<(typeof patternSchemas)[K]>;
};

export type PatternName = keyof PatternMap;
export type PatternMessage<T extends PatternName> = PatternMap[T];
