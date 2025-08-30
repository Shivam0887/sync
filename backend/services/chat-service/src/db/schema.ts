import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  uniqueIndex,
  boolean,
  pgEnum,
  primaryKey,
  foreignKey,
  index,
} from "drizzle-orm/pg-core";

export const messageStatusEnum = pgEnum("message_status", [
  "SENT",
  "DELIVERED",
  "READ",
]);

export const messageTypeEnum = pgEnum("message_type", [
  "TEXT",
  "IMAGE",
  "VIDEO",
  "VOICE",
  "FILE",
]);

export const chatTypeEnum = pgEnum("chat_type", ["direct", "group"]);

export const userPresenceEnum = pgEnum("presence_type", [
  "online",
  "offline",
  "away",
]);

export const usersTable = pgTable(
  "users",
  {
    id: uuid().primaryKey().defaultRandom(),
    username: varchar({ length: 255 }).notNull(),
    email: varchar({ length: 255 }).notNull(),
    password: varchar().notNull(),
    avatarUrl: varchar({ length: 500 }),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("unique_username").on(t.username),
    uniqueIndex("unique_email").on(t.email),
  ]
);

export const chatsTable = pgTable("chats", {
  id: uuid().primaryKey().defaultRandom(),
  type: chatTypeEnum().default("direct").notNull(), // 'direct' or 'group'
  name: varchar({ length: 255 }), // Optional chat name for group chats
  description: text(), // Optional description for group chats
  avatarUrl: varchar({ length: 500 }), // Avatar url for group chat
  createdBy: uuid().references(() => usersTable.id), // Who created the chat
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp().defaultNow().notNull(),
});

export const chatParticipantsTable = pgTable(
  "chat_participants",
  {
    chatId: uuid()
      .notNull()
      .references(() => chatsTable.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    joinedAt: timestamp().defaultNow().notNull(),
    leftAt: timestamp(), // Track when user left (for group chats)
    role: varchar({ length: 20 }).default("member").notNull(), // 'admin', 'member', etc.
  },
  (t) => [
    primaryKey({ columns: [t.chatId, t.userId] }),

    // Critical index for finding user's chats efficiently
    index("idx_chat_participants_user_id").on(t.userId),
    // Index for finding chat participants efficiently
    index("idx_chat_participants_chat_id").on(t.chatId),
  ]
);

export const messagesTable = pgTable(
  "messages",
  {
    id: uuid().primaryKey(),
    chatId: uuid()
      .notNull()
      .references(() => chatsTable.id, { onDelete: "cascade" }),
    senderId: uuid()
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    content: text().notNull(),
    messageType: messageTypeEnum().default("TEXT").notNull(), // 'text', 'image', 'file', etc.
    isEdited: boolean().default(false).notNull(),
    editedAt: timestamp(), // Track when message was edited
    replyToId: uuid(), // For reply functionality
    status: messageStatusEnum().default("SENT").notNull(),
    createdAt: timestamp().defaultNow().notNull(),
  },
  (t) => [
    foreignKey({ foreignColumns: [t.id], columns: [t.replyToId] }),

    // Critical indexes for message queries
    index("idx_messages_chat_id").on(t.chatId),
    index("idx_messages_sender_id").on(t.senderId),
    // Composite index for finding latest messages per chat efficiently
    index("idx_messages_chat_created").on(t.chatId, t.createdAt),
    // Index for unread message counts
    index("idx_messages_status").on(t.status),
  ]
);

export const groupInviteLinksTable = pgTable(
  "group_invite_links",
  {
    chatId: uuid()
      .notNull()
      .references(() => chatsTable.id, { onDelete: "cascade" }),
    token: varchar({ length: 64 }).notNull().unique(),
    createdBy: uuid()
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    createdAt: timestamp().defaultNow().notNull(),
    expiresAt: timestamp(), // Optional: set to null for non-expiring links
  },
  (t) => [index("idx_group_invite_links_chat_id_token").on(t.chatId, t.token)]
);

export const userStatusTable = pgTable("user_status", {
  userId: uuid()
    .primaryKey()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  status: userPresenceEnum().default("away").notNull(),
  lastSeen: timestamp().notNull(),
});
