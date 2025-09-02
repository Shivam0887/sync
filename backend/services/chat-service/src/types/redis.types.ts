import {
  TUserPresence,
  TMessageData,
  TMessageStatus,
  TUserTyping,
} from "./socket.types.js";

export type TIncomingMessage = Omit<TMessageData,  "conversationType"> & {
  userId: string;
};

export type TAckMessage = Omit<TMessageStatus, "senderId" | "conversationType">;

export interface PatternMap {
  "user_id:*": TIncomingMessage;
  "group_id:*": TIncomingMessage;
  "user_typing:*": TUserTyping;
  "ack:*": TAckMessage;
  presence_updates: TUserPresence;
}

export type PatternName = keyof PatternMap;
export type PatternMessage<T extends PatternName> = PatternMap[T];

export type PatternCallback = {
  [K in PatternName]?: (msg: any) => Promise<void> | void;
};
