import { db } from "@/db/index.js";
import {
  chatsTable,
  chatParticipantsTable,
  messagesTable,
  usersTable,
  groupInviteLinksTable,
} from "@/db/schema.js";
import { eq, and, inArray, desc, sql } from "drizzle-orm";
import { Request, Response, NextFunction } from "express";
import {
  NotFoundError,
  ConflictError,
  ValidationError,
  AuthorizationError,
} from "@shared/dist/error-handler/index.js";
import { randomBytes } from "crypto";
import z from "zod";

const groupSchema = z.object({
  name: z
    .string()
    .min(3, { error: "Group name must contain at least 3 charaters" })
    .max(50, { error: "Group name can't greater than 50 charaters" }),
  userIds: z.array(z.string()),
  description: z.string().nullable(),
});

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
        groupAvatarUrl: chatsTable.avatarUrl,
        chatDescription: chatsTable.description,
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
        role: chatParticipantsTable.role,
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
        role: participant.role,
      });
      return acc;
    }, {} as Record<string, Array<{ id: string; username: string; avatarUrl: string | null; role: string }>>);

    // Group invite link
    const inviteLinks = (
      await db
        .select({
          groupInviteLinkToken: groupInviteLinksTable.token,
          chatId: groupInviteLinksTable.chatId,
        })
        .from(groupInviteLinksTable)
        .where(inArray(groupInviteLinksTable.chatId, chatIds))
    ).reduce((result, { chatId, groupInviteLinkToken }) => {
      result[chatId] = groupInviteLinkToken;
      return result;
    }, {} as Record<string, string>);

    // Combine the data efficiently
    const result = conversations
      .map((conv) => ({
        id: conv.chatId,
        type: conv.chatType,
        name: conv.chatName,
        inviteLink: inviteLinks[conv.chatId]
          ? `/groups/join/${inviteLinks[conv.chatId]}`
          : null,
        avatarUrl: conv.groupAvatarUrl,
        description: conv.chatDescription,
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

export const createGroup = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user.id;
    const { name, description, userIds } = groupSchema.parse(req.body);

    // Create group chat
    const [chat] = await db
      .insert(chatsTable)
      .values({
        type: "group",
        name,
        description,
        createdBy: userId,
      })
      .returning();

    // Add creator as admin, others as members
    const participants = [
      { chatId: chat.id, userId, role: "admin" },
      ...userIds
        .filter((id: string) => id !== userId)
        .map((id: string) => ({
          chatId: chat.id,
          userId: id,
          role: "member",
        })),
    ];

    await db.insert(chatParticipantsTable).values(participants);

    // Generate a unique token
    const token = randomBytes(32).toString("hex");

    // Store invite link
    await db.insert(groupInviteLinksTable).values({
      chatId: chat.id,
      token,
      createdBy: userId,
    });

    res
      .status(201)
      .json({ groupId: chat.id, inviteLink: `/groups/join/${token}` });
  } catch (error) {
    next(error);
  }
};

export const addGroupMembers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user.id;
    const { groupId } = req.params;
    const { userIds } = groupSchema.pick({ userIds: true }).parse(req.body);

    // Check if user is admin of the group
    const admin = await db
      .select()
      .from(chatParticipantsTable)
      .where(
        and(
          eq(chatParticipantsTable.chatId, groupId),
          eq(chatParticipantsTable.userId, userId),
          eq(chatParticipantsTable.role, "admin")
        )
      );

    if (!admin.length) {
      throw new AuthorizationError("Only admins can add members");
    }

    // Add users as members
    const newMembers = userIds.map((id: string) => ({
      chatId: groupId,
      userId: id,
      role: "member",
    }));

    await db.insert(chatParticipantsTable).values(newMembers);

    res.status(200).json({ added: userIds });
  } catch (error) {
    next(error);
  }
};

export const regenerateInviteLink = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user.id;
    const { groupId } = req.params;

    // Check if user is a participant
    const participant = await db
      .select()
      .from(chatParticipantsTable)
      .where(
        and(
          eq(chatParticipantsTable.chatId, groupId),
          eq(chatParticipantsTable.userId, userId),
          eq(chatParticipantsTable.role, "admin")
        )
      );

    if (!participant.length) {
      throw new AuthorizationError("Only admins can regenerate invite link");
    }

    // Generate a unique token
    const token = randomBytes(32).toString("hex");

    // Store invite link
    await db
      .update(groupInviteLinksTable)
      .set({ token })
      .where(eq(groupInviteLinksTable.chatId, groupId));

    res.status(201).json({ inviteLink: `/groups/join/${token}` });
  } catch (error) {
    next(error);
  }
};

export const joinViaInviteLink = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user.id;
    const { inviteToken } = req.params;

    const invite = await db
      .select()
      .from(groupInviteLinksTable)
      .where(eq(groupInviteLinksTable.token, inviteToken));

    if (!invite.length) {
      throw new NotFoundError("Invalid invite link");
    }

    const groupId = invite[0].chatId;

    // Check if already a participant
    const existing = await db
      .select()
      .from(chatParticipantsTable)
      .where(
        and(
          eq(chatParticipantsTable.chatId, groupId),
          eq(chatParticipantsTable.userId, userId)
        )
      );

    if (existing.length) {
      throw new ConflictError("Already a group member");
    }

    await db.insert(chatParticipantsTable).values({
      chatId: groupId,
      userId,
      role: "member",
    });

    res.status(200).json({ groupId });
  } catch (error) {
    next(error);
  }
};
