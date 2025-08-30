import redis from "@/config/redis-db.js";

import z from "zod/v4";
import { randomBytes } from "crypto";
import { NextFunction, Request, Response } from "express";

import {
  chatParticipantsTable,
  chatsTable,
  groupInviteLinksTable,
} from "@/db/schema.js";
import { db } from "@/db/index.js";
import { and, count, eq, isNotNull } from "drizzle-orm";

import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
} from "@shared/dist/error-handler/index.js";
import { getSocketManagerInstance } from "@/socket/socket-manager.js";
import { redisKeys } from "@/lib/utils/index.js";

const groupSchema = z.object({
  name: z
    .string()
    .min(3, { error: "Group name must contain at least 3 charaters" })
    .max(50, { error: "Group name can't greater than 50 charaters" }),
  userIds: z.array(z.string()),
  description: z.string().nullable(),
});

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
      .returning({ id: chatsTable.id });

    // Add creator as admin, others as members
    const participants = userIds.map((id) => ({
      chatId: chat.id,
      userId: id,
      role: id === userId ? "admin" : "member",
    }));

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
    await SocketManager?.handleJoinGroup({ groupIds: [chat.id], userIds });

    await Promise.all(
      userIds.map(async (userId) => {
        const userChatGroupsKey = redisKeys.userChatGroups(userId);

        const result = await redis.get(userChatGroupsKey);
        const cachedUserGroups: string[] = result ? JSON.parse(result) : [];

        cachedUserGroups.push(chat.id);
        await redis.set(
          userChatGroupsKey,
          JSON.stringify(cachedUserGroups),
          "EX",
          30 * 24 * 60 * 60, // 30 days
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
      });

    const SocketManager = getSocketManagerInstance();
    await SocketManager?.handleJoinGroup({ groupIds: [groupId], userIds });

    await Promise.all(
      userIds.map(async (userId) => {
        const userChatGroupsKey = redisKeys.userChatGroups(userId);

        const result = await redis.get(userChatGroupsKey);
        const cachedUserGroups: string[] = result ? JSON.parse(result) : [];

        cachedUserGroups.push(groupId);
        await redis.set(
          userChatGroupsKey,
          JSON.stringify(cachedUserGroups),
          "EX",
          30 * 24 * 60 * 60,
          "NX"
        ); // Reset the expiration for active groups
      })
    );

    res.json({ added: userIds });
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
    const { groupId, userId } = req.params;

    await db
      .update(chatParticipantsTable)
      .set({ leftAt: new Date() })
      .where(
        and(
          eq(chatParticipantsTable.chatId, groupId),
          eq(chatParticipantsTable.userId, userId)
        )
      );

    const remainingGroupsMembers = (
      await db
        .select({ count: count(chatParticipantsTable.userId) })
        .from(chatParticipantsTable)
        .where(
          and(
            eq(chatParticipantsTable.chatId, groupId),
            isNotNull(chatParticipantsTable.leftAt)
          )
        )
    )[0];

    const SocketManager = getSocketManagerInstance();
    await SocketManager?.handleLeaveGroup({ groupId, userId });

    const userChatGroupsKey = redisKeys.userChatGroups(userId);

    if (!remainingGroupsMembers.count) {
      await redis.del(userChatGroupsKey);
    } else {
      const result = await redis.get(userChatGroupsKey);
      const cachedUserGroups: string[] = result ? JSON.parse(result) : [];

      await redis.set(
        userChatGroupsKey,
        JSON.stringify(cachedUserGroups.filter((g) => g !== groupId)),
        "EX",
        30 * 24 * 60 * 60,
        "NX"
      );
    }

    res.json({ message: `${userId} removed from group id ${groupId}` });
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
    await SocketManager?.handleJoinGroup({
      groupIds: [groupId],
      userIds: [userId],
    });

    const userChatGroupsKey = redisKeys.userChatGroups(userId);

    const result = await redis.get(userChatGroupsKey);
    const cachedUserGroups: string[] = result ? JSON.parse(result) : [];

    cachedUserGroups.push(groupId);
    await redis.set(userChatGroupsKey, JSON.stringify(cachedUserGroups), "XX");

    res.json({ groupId });
  } catch (error) {
    next(error);
  }
};
