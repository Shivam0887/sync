import type {
  ClientToServerEvents,
  IOServer,
  IOSocket,
} from "@/types/socket.types.js";

import { Server } from "socket.io";
import { Server as HttpServer } from "http";

import { env } from "@/config/env.js";
import redis from "@/config/redis-db.js";

import { v7 as uuidv7 } from "uuid";

import { userStatusTable } from "@/db/schema.js";
import { db } from "@/db/index.js";
import { sql } from "drizzle-orm";

import { redisKeys, redisPubSubKeys } from "@/lib/utils/index.js";
import {
  PatternMessage,
  PatternName,
  patternSchemas,
  TAck,
  TIncomingMessage,
  TUserPresence,
  TUserTyping,
} from "@/types/redis.types.js";

type TPresenceUpdate = Omit<TUserPresence, "lastSeen"> & { lastSeen: Date };

class SocketManager {
  private ioInstance: IOServer;
  private readonly sub = redis.duplicate();
  private readonly pub = redis.duplicate();

  private readonly userToSockets = new Map<string, Set<string>>();
  private readonly socketToUser = new Map<string, string>();

  private userPresence = new Map<string, TPresenceUpdate>();
  private presenceUpdateQueue: TPresenceUpdate[] = [];

  private initPatternMessageEvent = false;

  // Config
  private readonly BATCH_PROCESS_INTERVAL = 10 * 1000; // 10 seconds
  private readonly PRESENCE_UPDATE_INTERVAL = 60 * 1000; // 60 seconds

  private readonly OFFLINE_THRESHOLD = 60 * 1000; // 60 seconds
  private readonly AWAY_THRESHOLD = 30 * 1000; // 30 seconds

  private batchTimeout: NodeJS.Timeout | undefined = undefined;
  private presenceUpdateTimeout: NodeJS.Timeout | undefined = undefined;

  constructor(httpServer: HttpServer) {
    this.ioInstance = new Server(httpServer, {
      cors: { origin: [env.CORS_ORIGIN] },
      path: "/api/socket",
      addTrailingSlash: false,
    });

    this.subscribeRedisPatterns();
    this.setupIoConnection();

    this.startPeriodicPresenceUpdate();
    this.startBatchProcessing();
  }

  private async psubscribe<T extends PatternName>(
    pattern: T,
    cb: (message: PatternMessage<T>) => Promise<void> | void
  ) {
    try {
      await this.sub.psubscribe(pattern);

      if (!this.initPatternMessageEvent) {
        this.initPatternMessageEvent = true;

        this.sub.on("pmessage", (matchedPattern, channel, rawMessage) => {
          if (matchedPattern === pattern) {
            const message = patternSchemas[pattern].parse(rawMessage);
            cb(message as PatternMessage<T>);
          }
        });
      }
    } catch (error) {
      console.log(`[PSUBSCRIBE] error:`, error);
    }
  }

  private async subscribeRedisPatterns() {
    await this.psubscribe("user_id:*", this.onIncomingUserMessage);
    await this.psubscribe("user_id:*:typing", this.onUserTyping);
    await this.psubscribe("group_id:*", this.onIncomingGroupMessage);
    await this.psubscribe("ack:*", this.onIncomingAck);
    await this.psubscribe("presence_updates", this.broadcastPresenceUpdate);
  }

  private publishRedisPatterns<T extends PatternName>(
    channel: string,
    message: PatternMessage<T>
  ) {
    this.pub.publish(channel, JSON.stringify(message)).catch((error) => {
      console.log("[publishRedisPatterns] error:", error);
    });
  }

  private setupIoConnection() {
    this.ioInstance.on("connection", async (socket: IOSocket) => {
      const userId = socket.handshake.auth.userId;
      if (!userId) {
        socket.timeout(3000).emit("error", "Missing userId", () => {
          socket.disconnect();
        });

        console.log("Connection error:", "Missing userId");
      }

      this.mapUserSocket(socket.id, userId); // Map userId -> socketId and vice-versa
      this.setupSocketEventHandlers(socket); // Set up event handlers for the socket

      // Update user presence to online upon socket connection
      this.updatePresence({
        userId,
        status: "online",
        lastSeen: new Date().toISOString(),
      });

      this.setupGroupSubscriptions(userId);
    });
  }

  private mapUserSocket(socketId: string, userId: string) {
    this.socketToUser.set(socketId, userId);

    if (!this.userToSockets.has(userId)) {
      this.userToSockets.set(userId, new Set());
    }
    this.userToSockets.get(userId)!.add(socketId);
  }

  private setupSocketEventHandlers(socket: IOSocket) {
    socket
      .on("send_message", this.handleSendMessage.bind(this))
      .on("message_status", this.handleMessageStatusChange.bind(this))
      .on("user_typing", this.handleUserTyping.bind(this))
      .on("disconnect", this.handleDisconnect.bind(this, socket))
      .on("join_group", this.handleJoinGroup.bind(this))
      .on("leave_group", this.handleLeaveGroup.bind(this));
  }

  private updatePresence(presence: TUserPresence) {
    const userId = presence.userId;

    // Queue for batch database update
    this.queuePresenceUpdate(presence);

    this.publishRedisPatterns<"presence_updates">(
      redisPubSubKeys.presenceUpdates(),
      presence
    );

    redis
      .setex(
        redisKeys.userPresence(userId),
        7 * 24 * 60 * 60, // 7 days TTL
        JSON.stringify({
          status: presence.status,
          lastSeen: presence.lastSeen,
        })
      )
      .catch((error) => {
        console.log("Redis set user presence error", error);
      });
  }

  private async setupGroupSubscriptions(userId: string) {
    try {
      const cachedResult = await redis.get(redisKeys.userChatGroups(userId));
      if (!cachedResult) {
        throw new Error("Failed to find user groups");
      }

      const groupIds = JSON.parse(cachedResult) as string[];

      this.handleJoinGroup({ groupIds, userIds: [userId] });
    } catch (error) {
      console.error("[setupGroupSubscriptions] error:", error);
    }
  }

  private queuePresenceUpdate(presence: TUserPresence) {
    const updatedPresence = {
      ...presence,
      lastSeen: new Date(presence.lastSeen),
    };

    this.userPresence.set(updatedPresence.userId, updatedPresence);
    this.presenceUpdateQueue.push();
  }

  private startBatchProcessing() {
    this.batchTimeout = setInterval(() => {
      this.processBatchUpdates();
    }, this.BATCH_PROCESS_INTERVAL);
  }

  private startPeriodicPresenceUpdate() {
    this.presenceUpdateTimeout = setInterval(() => {
      this.watchPresenceStatus();
    }, this.PRESENCE_UPDATE_INTERVAL);
  }

  private async processBatchUpdates() {
    if (this.presenceUpdateQueue.length === 0) return;

    const updates = this.presenceUpdateQueue;
    this.presenceUpdateQueue = [];

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
      this.presenceUpdateQueue.push(...updates);
    }
  }

  private watchPresenceStatus() {
    const now = Date.now();

    for (const [userId, presence] of this.userPresence.entries()) {
      const timeSinceLastSeen = now - new Date(presence.lastSeen).getTime();
      const socketCount = this.userToSockets.get(userId)?.size ?? 0;

      const isOffline =
        presence.status !== "offline" &&
        timeSinceLastSeen > this.OFFLINE_THRESHOLD &&
        socketCount === 0;

      const isAway =
        presence.status === "online" &&
        timeSinceLastSeen > this.AWAY_THRESHOLD &&
        socketCount > 0;

      // Mark as away if online but inactive
      const newStatus = isAway ? "away" : isOffline ? "offline" : "online";

      if (newStatus === "offline") this.userPresence.delete(userId);

      if (newStatus !== "online") {
        this.updatePresence({
          userId,
          lastSeen: presence.lastSeen.toISOString(),
          status: newStatus,
        });
      }
    }
  }

  private async broadcastPresenceUpdate(presence: TUserPresence) {
    try {
      // Get user's contacts/groups that should receive presence updates
      const cachedResult = await redis.get(
        redisKeys.userContacts(presence.userId)
      );
      if (!cachedResult) {
        throw new Error("Unable to find user friend list");
      }

      const subscribers = JSON.parse(cachedResult) as string[];

      // Broadcast to subscribers
      for (const userId of subscribers) {
        if (presence.userId === userId) continue;

        const sockets = this.userToSockets.get(userId);
        if (!sockets) continue;

        sockets.forEach((socketId) => {
          const socket = this.ioInstance.sockets.sockets.get(socketId);

          if (socket) {
            socket.emit("presence_updates", presence);
          } else {
            this.cleanupSocket(socketId);
          }
        });
      }
    } catch (error) {
      console.log("[broadcastPresenceUpdate] error", error);
    }
  }

  private onIncomingUserMessage({ chatId, message, userId }: TIncomingMessage) {
    const sockets = this.userToSockets.get(userId);
    if (!sockets) return; // User is not connected -> Offline

    this.updatePresence({
      userId: message.senderId,
      status: "online",
      lastSeen: new Date().toISOString(),
    });

    let ackCount = 0;

    const messageDelivered = () => {
      this.publishRedisPatterns<"ack:*">(
        redisPubSubKeys.ackChannel(message.senderId),
        {
          chatId,
          userId: message.senderId,
          messageId: message.id,
          status: "DELIVERED",
        }
      );
    };

    try {
      // Emit to every socket for that user on this server
      for (const socketId of sockets.keys()) {
        const socket = this.ioInstance.sockets.sockets.get(socketId);
        if (socket) {
          socket.timeout(3000).emit("receive_message", {
            chatId,
            message,
            ack: async (err) => {
              if (err) {
                console.log("[receive_message] emit error:", err.message);
              } else {
                ackCount += 1;

                // If we successfully emitted to at least one socket, we can send a delivery acknowledgment
                // back to the sender of the message
                if (ackCount === 1) {
                  messageDelivered();
                }
              }
            },
          });
        } else {
          this.cleanupSocket(socketId);
        }
      }
    } catch (err) {
      console.error("Error handling user message:", err);
    }
  }

  private onIncomingGroupMessage({
    chatId,
    message,
  }: Omit<TIncomingMessage, "userId">) {
    const senderSockets = this.userToSockets.get(message.senderId);

    this.updatePresence({
      userId: message.senderId,
      status: "online",
      lastSeen: new Date().toISOString(),
    });

    this.ioInstance
      .to(chatId)
      .except(senderSockets ? Array.from(senderSockets) : [])
      .emit("receive_message", { chatId, message, ack: () => {} });
  }

  private onIncomingAck({ chatId, messageId, status, userId }: TAck) {
    const sockets = this.userToSockets.get(userId);
    if (!sockets) return;

    for (const socketId of sockets) {
      const socket = this.ioInstance.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit("message_status", { chatId, messageId, status });
      } else {
        this.cleanupSocket(socketId);
      }
    }
  }

  private onUserTyping({ chatId, isTyping, userId }: TUserTyping) {
    const sockets = this.userToSockets.get(userId);
    if (!sockets) return;

    for (const socketId of sockets) {
      const socket = this.ioInstance.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit("user_typing", { chatId, userId, isTyping });
      } else {
        this.cleanupSocket(socketId);
      }
    }
  }

  private handleSendMessage({
    ack,
    chatId,
    conversationType,
    message,
  }: Parameters<ClientToServerEvents["send_message"]>[0]) {
    try {
      const newId = uuidv7();

      ack({ tempId: message.id, newId });

      message.id = newId;

      const payload = {
        chatId,
        message: { ...message, status: "SENT" },
      };

      if (conversationType === "direct" && message.receiverId) {
        const userId = message.receiverId;
        this.publishRedisPatterns<"user_id:*">(
          redisPubSubKeys.userIdChannel(userId),
          { ...payload, userId }
        );
      } else {
        this.publishRedisPatterns<"group_id:*">(
          redisPubSubKeys.userIdChannel(chatId),
          payload
        );
      }
    } catch (err) {
      console.error("Error sending message:", err);
    }
  }

  private handleMessageStatusChange({
    senderId,
    chatId,
    messageId,
    status,
  }: Parameters<ClientToServerEvents["message_status"]>[0]) {
    this.publishRedisPatterns<"ack:*">(redisPubSubKeys.ackChannel(senderId), {
      chatId,
      userId: senderId,
      messageId,
      status,
    });
  }

  private handleUserTyping = ({
    chatId,
    userId,
    isTyping,
  }: Parameters<ClientToServerEvents["user_typing"]>[0]) => {
    this.publishRedisPatterns<"user_id:*:typing">(
      redisPubSubKeys.userTypingChannel(userId),
      {
        chatId,
        userId,
        isTyping,
      }
    );
  };

  async handleJoinGroup({
    groupIds,
    userIds,
  }: Parameters<ClientToServerEvents["join_group"]>[0]) {
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

  async handleLeaveGroup({
    groupId,
    userId,
  }: Parameters<ClientToServerEvents["leave_group"]>[0]) {
    try {
      const sockets = this.userToSockets.get(userId);
      if (!sockets) return;

      for (const socketId of sockets) {
        this.ioInstance.in(socketId).socketsLeave(groupId);
      }
    } catch (err) {
      console.error("[Leave group error]", err);
    }
  }

  private handleDisconnect(socket: IOSocket) {
    const userId = this.socketToUser.get(socket.id);
    if (!userId) return;

    this.updatePresence({
      userId,
      status: "offline",
      lastSeen: new Date().toISOString(),
    });
    this.cleanupSocket(socket.id);
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

  public io() {
    return this.ioInstance;
  }

  public cleanup() {
    this.pub.quit();
    this.sub.quit();

    clearInterval(this.batchTimeout);
    clearInterval(this.presenceUpdateTimeout);

    this.processBatchUpdates();
    this.watchPresenceStatus();

    redis.quit();
  }
}

let socketManagerInstance: SocketManager | null;

export default function initializeSocketManager(httpServer: HttpServer) {
  if (!socketManagerInstance) {
    socketManagerInstance = new SocketManager(httpServer);
  }
  return socketManagerInstance;
}

export const getSocketManagerInstance = () => socketManagerInstance;
