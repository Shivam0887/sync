export const redisKeys = {
  userChatGroups: (userId: string) => `user_chat_groups:${userId}`,
  userPresence: (userId: string) => `user_presence:${userId}`,
  userContacts: (userId: string) => `user_contacts:${userId}`,
};

export const redisPubSubKeys = {
  userIdChannel: (userId: string) => `user_id:${userId}`,
  userTypingChannel: (userId: string) => `user_id:${userId}:typing`,
  groupIdChannel: (chatId: string) => `group_id:${chatId}`,
  ackChannel: (userId: string) => `ack:${userId}`,
  presenceUpdates: () => "presence_updates",
};
