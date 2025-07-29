import { db } from "@/db/index.js";
import {
  chatsTable,
  chatParticipantsTable,
  messagesTable,
  usersTable,
} from "@/db/schema.js";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { Request, Response, NextFunction } from "express";
import {
  NotFoundError,
  ConflictError,
} from "@shared/dist/error-handler/index.js";

// Fetch all conversations for a user
export const getConversations = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user.id;

    // Single optimized query to get all conversation data
    const conversationsQuery = db
      .select({
        chatId: chatsTable.id,
        chatType: chatsTable.type,
        chatName: chatsTable.name,
        // Get latest message using window function
        latestMessage: sql<{ content: string; createdAt: Date } | null>`
          (SELECT json_build_object(
             'content', content,
             'createdAt', created_at
           )
           FROM messages 
           WHERE messages.chat_id = ${chatsTable.id} 
           ORDER BY created_at DESC 
           LIMIT 1)
        `,
        // Count unread messages efficiently
        unreadCount: sql<number>`
          (SELECT COUNT(*) 
           FROM messages 
           WHERE messages.chat_id = ${chatsTable.id} 
           AND messages.status != 'READ')
        `,
      })
      .from(chatParticipantsTable)
      .innerJoin(chatsTable, eq(chatParticipantsTable.chatId, chatsTable.id))
      .where(eq(chatParticipantsTable.userId, userId));

    const conversations = await conversationsQuery;

    if (!conversations.length) {
      res.json({ conversations: [] });
      return;
    }

    const chatIds = conversations.map((conv) => conv.chatId);

    // Single query to get all participants for all chats
    const participantsQuery = db
      .select({
        chatId: chatParticipantsTable.chatId,
        userId: usersTable.id,
        username: usersTable.username,
        avatarUrl: usersTable.avatarUrl,
      })
      .from(chatParticipantsTable)
      .innerJoin(usersTable, eq(usersTable.id, chatParticipantsTable.userId))
      .where(inArray(chatParticipantsTable.chatId, chatIds));

    const participants = await participantsQuery;

    // Group participants by chat ID efficiently
    const participantsByChat = participants.reduce((acc, participant) => {
      if (!acc[participant.chatId]) {
        acc[participant.chatId] = [];
      }
      acc[participant.chatId].push({
        id: participant.userId,
        username: participant.username,
        avatarUrl: participant.avatarUrl,
      });
      return acc;
    }, {} as Record<string, Array<{ id: string; username: string; avatarUrl: string | null }>>);

    // Combine the data efficiently
    const result = conversations
      .map((conv) => ({
        id: conv.chatId,
        type: conv.chatType,
        name: conv.chatName,
        participants: participantsByChat[conv.chatId] || [],
        unread: conv.unreadCount,
        lastMessage: conv.latestMessage?.content || "",
        timestamp: conv.latestMessage?.createdAt || null,
      }))
      // Sort by most recent activity
      .sort((a, b) => {
        if (!a.timestamp && !b.timestamp) return 0;
        if (!a.timestamp) return 1;
        if (!b.timestamp) return -1;
        return b.timestamp.getTime() - a.timestamp.getTime();
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
    const { otherUserId } = req.body;

    if (userId === otherUserId)
      throw new ConflictError("Cannot chat with yourself");

    // Finding all the chats of an authenticated user
    const participantChatIds = await db
      .select({ chatId: chatParticipantsTable.chatId })
      .from(chatParticipantsTable)
      .innerJoin(chatsTable, eq(chatParticipantsTable.chatId, chatsTable.id))
      .where(eq(chatsTable.type, "direct"));

    for (const chat of participantChatIds) {
      const participants = await db
        .select({ userId: chatParticipantsTable.userId })
        .from(chatParticipantsTable)
        .where(eq(chatParticipantsTable.chatId, chat.chatId));

      if (participants.some((p) => p.userId === otherUserId))
        throw new ConflictError("Converation already exists");
    }

    // Create new chat
    const [chat] = await db
      .insert(chatsTable)
      .values({ type: "direct" })
      .returning();

    await db.insert(chatParticipantsTable).values([
      { chatId: chat.id, userId },
      { chatId: chat.id, userId: otherUserId },
    ]);

    res.json({ chatId: chat.id });
  } catch (error) {
    next(error);
  }
};

// Send message (creates chat if needed for direct chat)
export const sendMessage = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user.id;
    const { chatId, content, receiverId } = req.body;
    let chatIdToUse = chatId;

    // If no chatId, create or get direct chat
    if (!chatId && receiverId) {
      const result = await createOrGetDirectChat(
        { ...req, body: { otherUserId: receiverId } } as any,
        {
          json: (data: any) => {
            chatIdToUse = data.chatId;
          },
        } as any,
        next
      );
    }

    // Check if user is participant
    const isParticipant = await db
      .select()
      .from(chatParticipantsTable)
      .where(
        and(
          eq(chatParticipantsTable.chatId, chatIdToUse),
          eq(chatParticipantsTable.userId, userId)
        )
      );

    if (!isParticipant.length)
      throw new NotFoundError("Conversation not found or access denied");

    // Insert message
    const [message] = await db
      .insert(messagesTable)
      .values({ chatId: chatIdToUse, senderId: userId, content })
      .returning();

    res.json({ message });
  } catch (error) {
    next(error);
  }
};
