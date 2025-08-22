import { randomBytes } from "crypto";
import z from "zod";
import redis from "@/config/redis-db.js";
import { db } from "@/db/index.js";

import {
  chatsTable,
  chatParticipantsTable,
  messagesTable,
  usersTable,
  groupInviteLinksTable,
  userStatusTable,
} from "@/db/schema.js";

import { eq, and, inArray, sql, isNull, isNotNull } from "drizzle-orm";

import { Request, Response, NextFunction } from "express";
import {
  NotFoundError,
  ConflictError,
  AuthorizationError,
} from "@shared/dist/error-handler/index.js";
import { getSocketManagerInstance } from "@/socket/socket-manager.js";

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
      .where(
        and(
          inArray(chatParticipantsTable.chatId, chatIds),
          isNull(chatParticipantsTable.leftAt)
        )
      );

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
        throw new ConflictError("Conversation already exists");
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
      await createOrGetDirectChat(
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
      .values({ chatId: chatIdToUse, senderId: userId, content, id: "" }) // TODO: Update with real id
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

    const SocketManager = getSocketManagerInstance();
    await SocketManager.handleJoinGroup([chat.id], userIds);
    await Promise.all(
      userIds.map(async (userId) => {
        const result = await redis.get(`ug:${userId}`);
        const cachedUserGroups: string[] = result ? JSON.parse(result) : [];

        cachedUserGroups.push(chat.id);
        await redis.set(
          `ug:${userId}`,
          JSON.stringify(cachedUserGroups),
          "EX",
          3600,
          "NX"
        );
      })
    );

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

    const members = userIds.map((id) => ({
      userId: id,
      chatId: groupId,
      role: "member",
    }));

    await db
      .insert(chatParticipantsTable)
      .values(members)
      .onConflictDoUpdate({
        target: [chatParticipantsTable.chatId, chatParticipantsTable.userId],
        set: { leftAt: null },
        setWhere: sql`left_at IS NOT NULL`,
      });

    const SocketManager = getSocketManagerInstance();
    await SocketManager.handleJoinGroup([groupId], userIds);

    await Promise.all(
      userIds.map(async (userId) => {
        const result = await redis.get(`ug:${userId}`);
        const cachedUserGroups: string[] = result ? JSON.parse(result) : [];

        cachedUserGroups.push(groupId);
        await redis.set(`ug:${userId}`, JSON.stringify(cachedUserGroups), "XX");
      })
    );

    res.status(200).json({ added: userIds });
  } catch (error) {
    next(error);
  }
};

export const removeGroupMembers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { groupId } = req.params;
    const user = (req as any).user;

    await db
      .update(chatParticipantsTable)
      .set({ leftAt: new Date() })
      .where(
        and(
          eq(chatParticipantsTable.chatId, groupId),
          eq(chatParticipantsTable.userId, user.id)
        )
      );

    const SocketManager = getSocketManagerInstance();
    await SocketManager.handleLeaveGroup(groupId, user.id);

    const result = await redis.get(`ug:${user.id}`);
    const cachedUserGroups: string[] = result ? JSON.parse(result) : [];

    await redis.set(
      `ug:${user.id}`,
      JSON.stringify(cachedUserGroups.filter((g) => g !== groupId)),
      "XX"
    );

    res.json({ message: `${user.id} removed from group id ${groupId}` });
  } catch (error) {
    console.error("[RemoveGroupMemebers] error:", error);
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

    if (existing.length && existing[0].leftAt === null) {
      throw new ConflictError("Already a group member");
    }

    // Re-join
    if (existing.length && existing[0].leftAt) {
      await db
        .update(chatParticipantsTable)
        .set({ leftAt: null })
        .where(
          and(
            eq(chatParticipantsTable.chatId, groupId),
            eq(chatParticipantsTable.userId, userId)
          )
        );
    } else if (existing.length === 0) {
      await db.insert(chatParticipantsTable).values({
        chatId: groupId,
        userId,
        role: "member",
      });
    }

    const SocketManager = getSocketManagerInstance();
    await SocketManager.handleJoinGroup([groupId], [userId]);

    const result = await redis.get(`ug:${userId}`);
    const cachedUserGroups: string[] = result ? JSON.parse(result) : [];

    cachedUserGroups.push(groupId);
    await redis.set(`ug:${userId}`, JSON.stringify(cachedUserGroups), "XX");

    res.status(200).json({ groupId });
  } catch (error) {
    next(error);
  }
};

export const getUserGroups = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;

    const cachedUserGroups = await redis.get(`ug:${userId}`);
    if (cachedUserGroups) {
      res.json({ data: JSON.parse(cachedUserGroups) });
      return;
    }

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
      `ug:${userId}`,
      JSON.stringify(userGroups),
      "EX",
      3600,
      "NX"
    );

    res.json({ data: userGroups });
  } catch (error) {
    console.error("[getUserGroups] error", error);
    next(error);
  }
};

export const getUserPresence = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { userId } = req.params;

  try {
    // Try Redis cache
    const cached = await redis.get(`presence:${userId}`);
    if (cached) {
      const parsed = JSON.parse(cached);
      res.json({
        data: {
          userId,
          status: parsed.status,
          lastSeen: new Date(parsed.lastSeen),
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
        data: {
          userId,
          status: dbPresence[0].status, // Assume offline if not in cache
          lastSeen: dbPresence[0].lastSeen,
        },
      });
      return;
    }

    res.json({ data: null });
  } catch (error) {
    next(error);
  }
};
