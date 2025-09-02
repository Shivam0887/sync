import redis from "@/config/redis-db.js";
import { redisKeys } from "@/lib/utils/index.js";

import { db } from "@/db/index.js";
import {
  chatsTable,
  chatParticipantsTable,
  messagesTable,
  usersTable,
  userStatusTable,
} from "@/db/schema.js";

import { eq, and, inArray, sql, isNull, count, ne } from "drizzle-orm";

import { Request, Response, NextFunction } from "express";
import {
  NotFoundError,
  ConflictError,
} from "@shared/dist/error-handler/index.js";
import { IParticipant } from "@/types/chat.types.js";

// Fetch all conversations for a user
export const getConversations = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user.id;

    // Single optimized query to get all conversation data
    const conversations = await db
      .select({
        id: chatsTable.id,
        type: chatsTable.type,
        name: chatsTable.name,
        avatarUrl: chatsTable.avatarUrl,
        description: chatsTable.description,
        lastMessage: sql<{ content: string; createdAt: Date } | null>`
          (SELECT json_build_object(
             'content', content,
             'createdAt', created_at
           )
           FROM messages 
           WHERE messages.chat_id = ${chatsTable.id} 
           ORDER BY created_at DESC 
           LIMIT 1)
        `,
        unreadCount: sql<number>`
          (SELECT COUNT(*) 
           FROM messages 
           WHERE messages.chat_id = ${chatsTable.id} 
           AND messages.status != 'READ')
        `,
        inviteLinkToken: sql<string | null>`
          (SELECT token
          FROM group_invite_links g
          WHERE g.chat_id = ${chatsTable.id})
        `,
      })
      .from(chatParticipantsTable)
      .innerJoin(chatsTable, eq(chatParticipantsTable.chatId, chatsTable.id))
      .where(eq(chatParticipantsTable.userId, userId));

    if (!conversations.length) {
      res.json({ conversations: [] });
      return;
    }

    const chatIds = conversations.map((conv) => conv.id);

    // Single query to get all participants for all chats
    const participants = await db
      .select({
        chatId: chatParticipantsTable.chatId,
        role: chatParticipantsTable.role,
        id: usersTable.id,
        username: usersTable.username,
        avatarUrl: usersTable.avatarUrl,
      })
      .from(chatParticipantsTable)
      .innerJoin(usersTable, eq(usersTable.id, chatParticipantsTable.userId))
      .where(
        and(
          inArray(chatParticipantsTable.chatId, chatIds),
          isNull(chatParticipantsTable.leftAt)
        )
      );

    // Group participants by chat ID efficiently
    const participantsByChat = participants.reduce((acc, participant) => {
      const { chatId, ...rest } = participant;
      if (!acc[participant.chatId]) {
        acc[participant.chatId] = [];
      }

      acc[participant.chatId].push(rest);
      return acc;
    }, {} as Record<string, Array<IParticipant>>);

    // Combine the data efficiently
    const result = conversations
      .map((conv) => ({
        ...conv,
        participants: participantsByChat[conv.id] || [],
      }))
      // Sort by most recent activity
      .sort((a, b) => {
        if (!a.lastMessage?.createdAt && !b.lastMessage?.createdAt) return 0;
        if (!a.lastMessage?.createdAt) return 1;
        if (!b.lastMessage?.createdAt) return -1;
        return (
          b.lastMessage.createdAt.getTime() - a.lastMessage.createdAt.getTime()
        );
      });

    res.json({ conversations: result });
  } catch (error) {
    next(error);
  }
};

// Fetch messages for a chat
export const getMessages = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user.id;
    const { chatId } = req.params;

    // Check if user is a participant
    const isParticipant = await db
      .select()
      .from(chatParticipantsTable)
      .where(
        and(
          eq(chatParticipantsTable.chatId, chatId),
          eq(chatParticipantsTable.userId, userId)
        )
      );

    if (!isParticipant.length)
      throw new NotFoundError("Conversation not found or access denied");

    const messages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.chatId, chatId));

    res.json({ messages });
  } catch (error) {
    next(error);
  }
};

// Create chat (only if not exists, for direct chat)
export const createOrGetDirectChat = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user.id;
    const { otherUserId } = req.params;

    if (userId === otherUserId)
      throw new ConflictError("Cannot chat with yourself");

    const participantChatIds = (
      await db
        .select({ chatId: chatsTable.id })
        .from(chatParticipantsTable)
        .innerJoin(
          chatsTable,
          and(
            eq(chatParticipantsTable.chatId, chatsTable.id),
            eq(chatsTable.type, "direct")
          )
        )
        .where(eq(chatParticipantsTable.userId, userId))
    ).map(({ chatId }) => chatId);

    const isConversationExists = await db
      .select({ count: count() })
      .from(chatParticipantsTable)
      .where(
        and(
          inArray(chatParticipantsTable.chatId, participantChatIds),
          eq(chatParticipantsTable.userId, otherUserId)
        )
      );

    if (isConversationExists.length) {
      throw new ConflictError("Conversation already exists");
    }

    // Create new chat
    const [chat] = await db
      .insert(chatsTable)
      .values({ type: "direct" })
      .returning({ id: chatsTable.id });

    await db.insert(chatParticipantsTable).values([
      { chatId: chat.id, userId },
      { chatId: chat.id, userId: otherUserId },
    ]);

    // Update the cache
    const cachedUserList = await redis.get(redisKeys.userContacts(userId));

    const userList: string[] = cachedUserList ? JSON.parse(cachedUserList) : [];
    userList.push(otherUserId);

    await redis.set(
      redisKeys.userContacts(userId),
      JSON.stringify(userList),
      "EX",
      30 * 24 * 60 * 60, // 30 days
      "NX"
    );

    res.json({ chatId: chat.id });
  } catch (error) {
    next(error);
  }
};

// Send message (creates chat if needed for direct chat)
// export const saveMessage = async (
//   req: Request,
//   res: Response,
//   next: NextFunction
// ) => {
//   try {
//     const userId = (req as any).user.id;
//     const { chatId, content, receiverId } = req.body;

//     // Check if user is participant
//     const isParticipant = await db
//       .select({ count: count() })
//       .from(chatParticipantsTable)
//       .where(
//         and(
//           eq(chatParticipantsTable.chatId, chatId),
//           eq(chatParticipantsTable.userId, userId)
//         )
//       );

//     if (!isParticipant.length)
//       throw new NotFoundError("User not found or access denied");

//     // Insert message
//     const [message] = await db
//       .insert(messagesTable)
//       .values({ chatId, senderId: userId, content, id: "" }) // TODO: Update with real id
//       .returning();

//     res.json({ message });
//   } catch (error) {
//     next(error);
//   }
// };

export const getUserPresence = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { userId } = req.params;

  try {
    // Try Redis cache
    const cached = await redis.get(redisKeys.userPresence(userId));
    if (cached) {
      const parsed = JSON.parse(cached);
      res.json({
        data: {
          userId,
          status: parsed.status,
          lastSeen: parsed.lastSeen,
        },
      });
      return;
    }

    // Fallback to database
    const dbPresence = await db
      .select()
      .from(userStatusTable)
      .where(eq(userStatusTable.userId, userId));

    if (dbPresence.length) {
      res.json({
        data: dbPresence[0],
      });
      return;
    }

    res.json({ data: null });
  } catch (error) {
    next(error);
  }
};

export const updateUserConnections = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { userId } = req.params;
  try {
    // Return users who should receive this user's presence updates
    let result = await redis.get(redisKeys.userContacts(userId));
    if (!result) {
      const cpt = db
        .select()
        .from(chatParticipantsTable)
        .where(eq(chatParticipantsTable.userId, userId))
        .as("cpt");

      const query = db
        .select({ userId: chatParticipantsTable.userId })
        .from(cpt)
        .innerJoin(
          chatsTable,
          and(eq(chatsTable.id, cpt.chatId), eq(chatsTable.type, "direct"))
        )
        .innerJoin(
          chatParticipantsTable,
          and(
            eq(chatParticipantsTable.chatId, chatsTable.id),
            ne(chatParticipantsTable.userId, userId)
          )
        );

      const userIds = (await query).map(({ userId }) => userId);

      await redis.set(
        redisKeys.userContacts(userId),
        JSON.stringify(userIds),
        "EX",
        30 * 24 * 60 * 60, // 30 days
        "NX"
      );
    }

    // Return users who should receive this group messages
    const cachedUserGroups = await redis.get(redisKeys.userChatGroups(userId));

    if (!cachedUserGroups) {
      const query = db
        .select({ groupId: chatsTable.id })
        .from(chatParticipantsTable)
        .innerJoin(chatsTable, eq(chatParticipantsTable.chatId, chatsTable.id))
        .where(
          and(
            eq(chatParticipantsTable.userId, userId),
            isNull(chatParticipantsTable.leftAt),
            eq(chatsTable.type, "group")
          )
        );

      const userGroups = (await query).map(({ groupId }) => groupId);
      await redis.set(
        redisKeys.userChatGroups(userId),
        JSON.stringify(userGroups),
        "EX",
        30 * 24 * 60 * 60, // 30 days
        "NX"
      );
    }

    res.end();
  } catch (error) {
    next(error);
  }
};
