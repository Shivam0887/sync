import type { IMessage, IOServer, IOSocket } from "@/types/index.js";
import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { env } from "@/config/env.js";
import redis from "@/config/redis-db.js";
import z from "zod";
import { v7 as uuidv7 } from "uuid";
import { db } from "@/db/index.js";
import {
  chatParticipantsTable,
  chatsTable,
  userStatusTable,
} from "@/db/schema.js";
import { and, eq, sql } from "drizzle-orm";

const payloadSchema = z.object({
  chatId: z.string(),
  message: z.custom<IMessage>().optional(),
  messageId: z.string().optional(),
  status: z.enum(["DELIVERED", "READ"]).optional(),
  isTyping: z.boolean().optional(),
});

interface PresenceStatus {
  userId: string;
  status: "online" | "away" | "offline";
  lastSeen: Date;
  socketCount: number; // Multiple devices/tabs
}

type PresenceUpdate = Omit<PresenceStatus, "socketCount">;

const HOST = "http://localhost";

class SocketManager {
  private ioInstance: IOServer;
  private readonly sub = redis.duplicate();
  private readonly pub = redis.duplicate();

  private readonly userToSockets = new Map<string, Set<string>>();
  private readonly socketToUser = new Map<string, string>();

  private readonly subscribedUserIds = new Set<string>();
  private readonly subscribedGroupIds = new Set<string>();

  private userPresence = new Map<string, PresenceStatus>();
  private presenceUpdateQueue = new Map<string, PresenceUpdate>();
  private batchTimer: NodeJS.Timeout | undefined = undefined;

  // Config
  private readonly BATCH_INTERVAL = 5000; // 5 seconds
  private readonly OFFLINE_THRESHOLD = 30000; // 30 seconds
  private readonly AWAY_THRESHOLD = 60000; // 1 minute

  private redisListenerInitialized = false;

  constructor(httpServer: HttpServer) {
    this.ioInstance = new Server(httpServer, {
      cors: { origin: [env.CORS_ORIGIN] },
      path: "/api/socket",
      addTrailingSlash: false,
    });

    this.initializeRedisListener();
    this.setupConnectionHandling();

    this.startPeriodicCleanup();
    this.startBatchProcessor();
  }

  private initializeRedisListener() {
    if (this.redisListenerInitialized) return;
    this.redisListenerInitialized = true;

    this.sub.subscribe("presence_updates"); // TODO: Unsub

    this.sub.on("message", async (channel: string, raw: string) => {
      try {
        const parsed = JSON.parse(raw);

        if (channel === "presence_updates") {
          const { userId, status, lastSeen } = parsed;
          this.broadcastPresenceUpdate(userId, status, lastSeen);
        } else {
          const { chatId, message, status, messageId, isTyping } =
            payloadSchema.parse(parsed);

          if (channel.startsWith("u:")) {
            const targetUserId = channel.slice(2);

            if (message && isTyping === undefined) {
              await this.onIncomingUserMessage(targetUserId, chatId, message);
            } else if (!message && isTyping !== undefined) {
              await this.onUserTyping(chatId, targetUserId, isTyping);
            }
          } else if (channel.startsWith("g:") && message) {
            const groupId = channel.slice(2);
            await this.onIncomingGroupMessage(groupId, message);
          } else if (channel.startsWith("ack:") && status && messageId) {
            const senderUserId = channel.slice(4);
            await this.onIncomingAck(senderUserId, chatId, messageId, status);
          } else {
            console.warn("Unknown redis channel:", channel);
          }
        }
      } catch (err) {
        console.error("Failed to handle Redis message", err, raw);
      }
    });
  }

  private setupConnectionHandling() {
    this.ioInstance.on("connection", async (socket: IOSocket) => {
      try {
        const userId = socket.handshake.auth.userId;
        if (!userId) throw new Error("Missing userId");

        this.trackSocketConnection(socket.id, userId); // Map userId -> socketId and vice-versa
        this.setupSocketHandlers(socket); // Set up event handlers for the socket

        await this.subscribeUserId(userId); // Subscribe to user channels
        this.setupGroupSubscriptions(userId); // Update presence to online

        await this.updatePresence(userId, "online", new Date());
      } catch (err) {
        console.error("Connection error:", err);
        socket.disconnect();
      }
    });
  }

  private async updatePresence(
    userId: string,
    status: PresenceStatus["status"],
    lastSeen: Date
  ) {
    const presence: PresenceStatus = {
      userId,
      status,
      lastSeen,
      socketCount: this.userToSockets.get(userId)?.size || 0,
    };

    this.pub.publish(
      "presence_updates",
      JSON.stringify({ userId, status, lastSeen: lastSeen.toISOString() })
    );

    this.userPresence.set(userId, presence);

    // Cache in Redis with TTL
    await redis.setex(
      `presence:${userId}`,
      300, // 5 minutes TTL
      JSON.stringify({ status, lastSeen: lastSeen.toISOString() })
    );

    // Queue for batch database update
    this.queuePresenceUpdate(userId, status, lastSeen);
  }

  private queuePresenceUpdate(
    userId: string,
    status: PresenceStatus["status"],
    lastSeen: Date
  ) {
    this.presenceUpdateQueue.set(userId, { userId, status, lastSeen });
  }

  private startBatchProcessor() {
    this.batchTimer = setInterval(() => {
      this.processBatchUpdates();
    }, this.BATCH_INTERVAL);
  }

  private async processBatchUpdates() {
    if (this.presenceUpdateQueue.size === 0) return;

    const updates = Array.from(this.presenceUpdateQueue.values());
    this.presenceUpdateQueue.clear();

    try {
      // Batch update database
      await db
        .insert(userStatusTable)
        .values(updates)
        .onConflictDoUpdate({
          target: userStatusTable.userId,
          set: {
            status: sql`excluded.status`,
            lastSeen: sql`excluded.last_seen`,
          },
        });
    } catch (error) {
      console.error("Failed to batch update presence:", error);
      // Re-queue failed updates
      updates.forEach((update) => {
        this.presenceUpdateQueue.set(update.userId, update);
      });
    }
  }

  private startPeriodicCleanup() {
    this.batchTimer = setInterval(() => {
      this.cleanupStalePresence();
      this.updateAwayStatus();
    }, 60000); // Every minute
  }

  private cleanupStalePresence() {
    const now = Date.now();

    for (const [userId, presence] of this.userPresence.entries()) {
      const timeSinceLastSeen = now - presence.lastSeen.getTime();

      // Mark as offline if no activity and no sockets
      if (
        timeSinceLastSeen > this.OFFLINE_THRESHOLD &&
        presence.socketCount === 0
      ) {
        this.updatePresence(userId, "offline", presence.lastSeen);
      }
    }
  }

  private updateAwayStatus() {
    const now = Date.now();

    for (const [userId, presence] of this.userPresence.entries()) {
      const timeSinceLastSeen = now - presence.lastSeen.getTime();

      // Mark as away if online but inactive
      if (
        presence.status === "online" &&
        timeSinceLastSeen > this.AWAY_THRESHOLD &&
        presence.socketCount > 0
      ) {
        this.updatePresence(userId, "away", presence.lastSeen);
      }
    }
  }

  private async broadcastPresenceUpdate(
    userId: string,
    status: PresenceStatus["status"],
    lastSeen: string
  ) {
    // Get user's contacts/groups that should receive presence updates
    const subscribers = await this.getPresenceSubscribers(userId);
    // Broadcast to subscribers
    for (const { userId: id } of subscribers) {
      if (userId === id) continue;

      const sockets = this.userToSockets.get(id);
      if (!sockets) continue;

      sockets.forEach((socketId) => {
        const socket = this.ioInstance.sockets.sockets.get(socketId);

        if (socket) {
          socket.emit("presence_updates", userId, status, lastSeen);
        } else {
          this.cleanupSocket(socketId);
        }
      });
    }
  }

  private async getPresenceSubscribers(userId: string): Promise<
    {
      userId: string;
    }[]
  > {
    // Return users who should receive this user's presence updates
    let result = await redis.get(`u:contacts:${userId}`);
    if (result) return JSON.parse(result);

    const cpt = db
      .select()
      .from(chatParticipantsTable)
      .where(eq(chatParticipantsTable.userId, userId))
      .as("cpt");

    const dbResult = await db
      .select({ userId: chatParticipantsTable.userId })
      .from(cpt)
      .innerJoin(
        chatsTable,
        and(eq(chatsTable.id, cpt.chatId), eq(chatsTable.type, "direct"))
      )
      .innerJoin(
        chatParticipantsTable,
        eq(chatParticipantsTable.chatId, chatsTable.id)
      );

    await redis.set(
      `u:contacts:${userId}`,
      JSON.stringify(dbResult),
      "EX",
      3600
    );

    return dbResult; // Placeholder
  }

  private trackSocketConnection(socketId: string, userId: string) {
    this.socketToUser.set(socketId, userId);

    if (!this.userToSockets.has(userId)) {
      this.userToSockets.set(userId, new Set());
    }
    this.userToSockets.get(userId)!.add(socketId);
  }

  private async setupGroupSubscriptions(userId: string) {
    try {
      const response = await fetch(
        `${HOST}:${env.PORT}/api/chat/groups/${userId}`
      );

      if (!response.ok) throw new Error("Failed to getUserGroups");

      const { data } = await response.json();

      if (Array.isArray(data)) {
        for (const groupId of data) {
          await this.subscribeGroupId(groupId);
        }

        await this.handleJoinGroup(data, [userId]);
      }
    } catch (error) {
      console.error("[setupGroupSubscriptions] error:", error);
    }
  }

  private setupSocketHandlers(socket: IOSocket) {
    socket
      .on("send_message", this.handleSendMessage.bind(this))
      .on("message_status", this.handleMessageStatusChange.bind(this))
      .on("user_typing", this.handleUserTyping.bind(this))
      .on("disconnect", (reason) =>
        this.handleDisconnect.call(this, reason, socket)
      )
      .on("join_group", this.handleJoinGroup.bind(this))
      .on("leave_group", this.handleLeaveGroup.bind(this));
  }

  private async subscribeUserId(userId: string) {
    const userChannel = `u:${userId}`;
    const ackChannel = `ack:${userId}`;

    if (!this.subscribedUserIds.has(userId)) {
      await Promise.all([
        this.sub.subscribe(userChannel),
        this.sub.subscribe(ackChannel),
      ]);
      this.subscribedUserIds.add(userId);
    }
  }

  private async unsubscribeUserId(userId: string) {
    const sockets = this.userToSockets.get(userId);
    if (!sockets || sockets.size > 0) return;

    const userChannel = `u:${userId}`;
    const ackChannel = `ack:${userId}`;

    if (this.subscribedUserIds.has(userId)) {
      await Promise.all([
        this.sub.unsubscribe(userChannel),
        this.sub.unsubscribe(ackChannel),
      ]);
      this.subscribedUserIds.delete(userId);
    }
  }

  private async subscribeGroupId(groupId: string) {
    const channel = `g:${groupId}`;
    if (!this.subscribedGroupIds.has(groupId)) {
      await this.sub.subscribe(channel);
      this.subscribedGroupIds.add(groupId);
    }
  }

  private async unsubscribeGroupId(groupId: string) {
    const channel = `g:${groupId}`;
    if (this.subscribedGroupIds.has(groupId)) {
      await this.sub.unsubscribe(channel);
      this.subscribedGroupIds.delete(groupId);
    }
  }

  private async onIncomingUserMessage(
    userId: string,
    chatId: string,
    message: IMessage
  ) {
    const sockets = this.userToSockets.get(userId);
    if (!sockets) return; // User is not connected -> Offline

    this.updatePresence(message.senderId, "online", new Date());

    let ackCount = 0;

    try {
      // Emit to every socket for that user on this server
      for (const socketId of sockets.keys()) {
        const socket = this.ioInstance.sockets.sockets.get(socketId);
        if (socket) {
          socket
            .timeout(3000)
            .emit("receive_message", chatId, message, async (err) => {
              if (err) {
                console.log("[receive_message] emit error:", err.message);
              } else {
                ackCount += 1;

                // If we successfully emitted to at least one socket, we can send a delivery acknowledgment
                // back to the sender of the message
                if (ackCount === 1) {
                  await this.pub.publish(
                    `ack:${message.senderId}`,
                    JSON.stringify({
                      chatId,
                      messageId: message.id,
                      status: "DELIVERED",
                    })
                  );
                }
              }
            });
        } else {
          this.cleanupSocket(socketId);
        }
      }
    } catch (err) {
      console.error("Error handling user message:", err);
    }
  }

  private async onIncomingGroupMessage(groupId: string, message: IMessage) {
    const senderSockets = this.userToSockets.get(message.senderId);

    this.updatePresence(message.senderId, "online", new Date());

    this.ioInstance
      .to(groupId)
      .except(senderSockets ? Array.from(senderSockets) : [])
      .emit("receive_message", groupId, message, () => {});
  }

  private async onIncomingAck(
    senderUserId: string,
    chatId: string,
    messageId: string,
    status: "DELIVERED" | "READ"
  ) {
    const sockets = this.userToSockets.get(senderUserId);
    if (!sockets) return;

    for (const socketId of sockets) {
      const socket = this.ioInstance.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit("message_status", chatId, messageId, status);
      } else {
        this.cleanupSocket(socketId);
      }
    }
  }

  private async onUserTyping(
    chatId: string,
    userId: string,
    isTyping: boolean
  ) {
    const sockets = this.userToSockets.get(userId);
    if (!sockets) return;

    for (const socketId of sockets) {
      const socket = this.ioInstance.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit("user_typing", chatId, userId, isTyping);
      } else {
        this.cleanupSocket(socketId);
      }
    }
  }

  private async handleSendMessage(
    chatId: string,
    message: IMessage,
    ack: (response: { tempId: string; newId: string }) => void
  ) {
    try {
      const newId = uuidv7();

      ack({ tempId: message.id, newId });

      message.id = newId;

      const payload = JSON.stringify({
        chatId,
        message: { ...message, status: "SENT" },
      });

      const channel =
        message.type === "direct" ? `u:${message.receiverId}` : `g:${chatId}`;

      await this.pub.publish(channel, payload);
    } catch (err) {
      console.error("Error sending message:", err);
    }
  }

  private async handleMessageStatusChange(
    senderId: string,
    chatId: string,
    messageId: string,
    status: string
  ) {
    await this.pub.publish(
      `ack:${senderId}`,
      JSON.stringify({
        chatId,
        messageId,
        status,
      })
    );
  }

  private handleUserTyping = async (
    chatId: string,
    userId: string,
    isTyping: boolean
  ) => {
    await this.pub.publish(
      `u:${userId}`,
      JSON.stringify({
        chatId,
        isTyping,
      })
    );
  };

  async handleJoinGroup(groupIds: string[], userIds: string[]) {
    try {
      for (const userId of userIds) {
        const sockets = this.userToSockets.get(userId);
        if (!sockets) continue;

        for (const socketId of sockets) {
          this.ioInstance.in(socketId).socketsJoin(groupIds);
        }
      }
    } catch (err) {
      console.error("[Join group error]", err);
    }
  }

  async handleLeaveGroup(groupId: string, userId: string) {
    try {
      const sockets = this.userToSockets.get(userId);
      if (!sockets) return;

      for (const socketId of sockets) {
        this.ioInstance.in(socketId).socketsLeave(groupId);
      }

      // return all Socket instances in the "groupId" room of the main namespace
      const members = await this.ioInstance.in(groupId).fetchSockets();

      if (members.length === 0) {
        await this.unsubscribeGroupId(groupId);
      }
    } catch (err) {
      console.error("[Leave group error]", err);
    }
  }

  private async handleDisconnect(reason: string, socket: IOSocket) {
    console.log("Socket disconnected:", socket.id, reason);

    const connectedClients = await this.ioInstance.fetchSockets();

    if (connectedClients.length === 0) {
      clearInterval(this.batchTimer);
      this.sub.unsubscribe("presence_updates");
    }

    const userId = this.socketToUser.get(socket.id);
    if (!userId) return;

    await this.updatePresence(userId, "offline", new Date());

    this.cleanupSocket(socket.id);

    // Clean user subscriptions if no sockets left
    if (!this.userToSockets.get(userId)?.size) {
      await this.unsubscribeUserId(userId);
    }

    const groups = Array.from(socket.rooms);

    for (const groupId of groups) {
      // return all Socket instances in the "groupId" room of the main namespace
      const members = await this.ioInstance.in(groupId).fetchSockets();

      if (members.length === 0) {
        await this.unsubscribeGroupId(groupId);
      }
    }
  }

  private cleanupSocket(socketId: string) {
    const userId = this.socketToUser.get(socketId);
    if (!userId) return;

    this.socketToUser.delete(socketId);
    const userSockets = this.userToSockets.get(userId);
    if (userSockets) {
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.userToSockets.delete(userId);
      }
    }
  }

  public get io() {
    return this.ioInstance;
  }
}

let socketManagerInstance: SocketManager;

export default function initializeSocketManager(
  httpServer: HttpServer
): IOServer {
  if (!socketManagerInstance) {
    socketManagerInstance = new SocketManager(httpServer);
  }
  return socketManagerInstance.io;
}

export const getSocketManagerInstance = () => socketManagerInstance;
