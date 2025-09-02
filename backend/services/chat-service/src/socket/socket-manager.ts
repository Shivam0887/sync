import {
  TUserPresence,
  TUserTyping,
  type ClientToServerEvents,
  type IOServer,
  type IOSocket,
} from "@/types/socket.types.js";

import { Server } from "socket.io";
import { Server as HttpServer } from "http";

import { env } from "@/config/env.js";
import redis from "@/config/redis-db.js";
import { v7 as uuidv7 } from "uuid";

import { redisKeys, redisPubSubKeys } from "@/lib/utils/index.js";
import {
  PatternCallback,
  PatternMessage,
  PatternName,
  TIncomingMessage,
  TAckMessage,
} from "@/types/redis.types.js";

import { ConnectionManager } from "./connection-manager.js";
import { PresenceManager } from "./presence-manager.js";
import { MessageRouter } from "./message-router.js";
import {
  validateJoinGroup,
  validateLeaveGroup,
  validateMessageStatus,
  validateSendMessage,
  validateUserTyping,
} from "./input-validation.js";

export type PublishPattern = <T extends PatternName>(patternType: T, channel: string, message: PatternMessage<T>) => Promise<void>;

class SocketManager {
  private ioInstance: IOServer;
  private connectionManager: ConnectionManager;
  private presenceManager: PresenceManager;
  private messageRouter: MessageRouter;

  private redisSubscriber: typeof redis;
  private redisPublisher: typeof redis;
  private patternRegistry = new Set<string>();
  private registerPatternCallback: PatternCallback = {};
  private initPatternMessageEvent = false;

  constructor(httpServer: HttpServer) {
    this.redisSubscriber = redis.duplicate();
    this.redisPublisher = redis.duplicate();

    this.ioInstance = new Server(httpServer, {
      cors: { origin: [env.CORS_ORIGIN] },
      path: "/api/socket",
      addTrailingSlash: false,
    });

    this.connectionManager = new ConnectionManager();

    this.presenceManager = new PresenceManager(
      this.connectionManager,
      this.publishRedisPattern,
      redis
    );

    this.messageRouter = new MessageRouter(
      this.connectionManager,
      this.ioInstance,
      this.publishRedisPattern,
    );

    this.subscribeRedisPatterns();
    this.setupSocketHandlers();
    this.presenceManager.startMonitoring();

    console.info('Socket Manager initialized successfully');
  }

  private async subscribeRedisPatterns(): Promise<void> {
    await this.psubscribe("user_id:*", this.onIncomingUserMessage.bind(this));
    await this.psubscribe("user_typing:*", this.onUserTyping.bind(this));
    await this.psubscribe("group_id:*", this.onIncomingGroupMessage.bind(this));
    await this.psubscribe("ack:*", this.onIncomingAck.bind(this));
    await this.psubscribe("presence_updates", this.broadcastPresenceUpdate.bind(this));
  }

  private async psubscribe<T extends PatternName>(
    pattern: T,
    cb: (message: PatternMessage<T>) => Promise<void> | void
  ): Promise<void> {
    try {
      await this.redisSubscriber.psubscribe(pattern);
      this.patternRegistry.add(pattern);
      this.registerPatternCallback[pattern] = cb;

      if (!this.initPatternMessageEvent) {
        this.initPatternMessageEvent = true;

        this.redisSubscriber.on("pmessage", (matchedPattern, channel, rawMessage) => {
          try {
            if (this.patternRegistry.has(matchedPattern)) {
              const typedPattern = matchedPattern as PatternName;
              this.registerPatternCallback[typedPattern]?.(JSON.parse(rawMessage));
            }
          } catch (parseError) {
            console.error(`[PMESSAGE] Parse error for pattern ${matchedPattern}:`, parseError);
          }
        });
      }
    } catch (error) {
      console.error(`[PSUBSCRIBE] error for pattern ${pattern}:`, error);
    }
  }

  private async publishRedisPattern<T extends PatternName>(
    patternType: T,
    channel: string,
    message: PatternMessage<T>
  ) {
    try {
      await this.redisPublisher.publish(channel, JSON.stringify(message));
    } catch (error) {
      console.error(`[publishRedisPattern] error for pattern ${patternType}:`, error);
      throw error;
    }
  }

  private setupSocketHandlers(): void {
    this.ioInstance.on("connection", async (socket: IOSocket) => {
      try {
        const userId = socket.handshake.auth.userId;
  
        if (!userId || typeof userId !== 'string') {
          socket.timeout(3000).emit("error", "Invalid userId", () => {
            socket.disconnect();
          });
          return null;
        }

        this.connectionManager.mapUserSocket(socket.id, userId);
        
        await this.presenceManager.updatePresence({
          userId,
          status: "online",
          lastSeen: new Date().toISOString(),
        });

        this.setupSocketEventHandlers(socket, userId);
        await this.setupGroupSubscriptions(userId);

      } catch (error) {
        console.error('Error setting up socket connection:', error);
        socket.disconnect();
      }
    });
  }

  private setupSocketEventHandlers(socket: IOSocket, userId: string): void {
    socket
      .on("send_message", this.handleSendMessage.bind(this, socket))
      .on("message_status", this.handleMessageStatusChange.bind(this, socket))
      .on("user_typing", this.handleUserTyping.bind(this, socket))
      .on("disconnect", this.handleDisconnect.bind(this, socket))
      .on("join_group", this.handleJoinGroup.bind(this))
      .on("leave_group", this.handleLeaveGroup.bind(this))
      .on("error", (error) => console.error(`Socket error for user ${userId}:`, error));
  }

  private async setupGroupSubscriptions(userId: string): Promise<void> {
    try {
      const cachedResult = await redis.get(redisKeys.userChatGroups(userId));
      if (!cachedResult) {
        console.warn(`No cached groups found for user ${userId}`);
        return;
      }

      const groupIds = JSON.parse(cachedResult) as string[];
      await this.handleJoinGroup({ groupIds, userIds: [userId] });
    } catch (error) {
      console.error(`[setupGroupSubscriptions] error for user ${userId}:`, error);
    }
  }

  // Enhanced event handlers with validation and error handling
  private async handleSendMessage(
    socket: IOSocket,
    data: unknown,
    ack: Parameters<ClientToServerEvents["send_message"]>[1]
  ) {
    const validation = validateSendMessage(data);
    if (!validation.success) {
      console.warn(`Send message validation failed:`, validation.error);
      socket.emit("error", validation.error);
      return;
    }

    const { chatId, conversationType, message } = validation.data;

    try {
      const newId = uuidv7();
      ack({ tempId: message.id, newId });

      const enhancedMessage = {
        ...message,
        id: newId,
        status: "SENT" as const,
        timestamp: new Date().toISOString()
      };

      const payload: TIncomingMessage = {
        chatId,
        message: enhancedMessage,
        userId: conversationType === "direct" ? message.receiverId! : message.senderId
      };

      if (conversationType === "direct" && message.receiverId) {
        await this.publishRedisPattern("user_id:*", redisPubSubKeys.userIdChannel(message.receiverId), payload);
      } else if (conversationType === "group") {
        await this.publishRedisPattern("group_id:*", redisPubSubKeys.groupIdChannel(chatId), payload);
      }

    } catch (error) {
      console.error("Error sending message:", error);
      socket.emit("error", 'Failed to send message');
    }
  }

  private async handleMessageStatusChange(socket: IOSocket, data: unknown) {
    const validation = validateMessageStatus(data);
    if (!validation.success) {
      console.warn(`Message status validation failed:`, validation.error);
      socket.emit("error", validation.error);
      return;
    }

    const { chatId, conversationType, messageId, senderId, status, userId } = validation.data;
    
    try {
      if (conversationType === "group") {
        
        // Handle group message read tracking
        if (!this.messageRouter['readCountPerGroup'].has(messageId)) {
          this.messageRouter['readCountPerGroup'].set(messageId, new Set());
        }

        this.messageRouter['readCountPerGroup'].get(messageId)?.add(userId);
        const readCount = this.messageRouter['readCountPerGroup'].get(messageId)!.size;

        // Check if all group members have read the message
        const totalMembers = await redis.get(redisKeys.usersPerGroup(chatId));
        const memberCount = totalMembers ? parseInt(totalMembers, 10) : 2;

        if (!isNaN(memberCount) && readCount + 1 < memberCount) {
          return; // Wait for more members to read
        }

        // All members have read, clean up and send final ack
        this.messageRouter['readCountPerGroup'].delete(messageId);
      }

      await this.publishRedisPattern("ack:*", redisPubSubKeys.ackChannel(senderId), {
        chatId,
        userId: senderId,
        messageId,
        status,
      });

    } catch (error) {
      console.error(`Error handling message status change:`, error);
    }
  }

  private async handleUserTyping(socket: IOSocket, data: unknown) {
    const validation = validateUserTyping(data);
    if (!validation.success) {
      console.warn(`User typing validation failed:`, validation.error);
      socket.emit("error", validation.error);
      return;
    }

    try {
      await this.publishRedisPattern("user_typing:*", redisPubSubKeys.userTypingChannel(validation.data.userId), validation.data);
    } catch (error) {
      console.error('Error handling user typing:', error);
    }
  }

  async handleJoinGroup(data: unknown) {
    try {
      const validation = validateJoinGroup(data);
      if (!validation.success) {
        console.warn(`Join group validation failed:`, validation.error);
        throw new Error(validation.error);
      }

      const { groupIds, userIds } = validation.data;

      for (const userId of userIds) {
        const sockets = this.connectionManager.getUserSockets(userId);
        if (!sockets) continue;

        for (const socketId of sockets) {
          this.ioInstance.in(socketId).socketsJoin(groupIds);
        }
      }
    } catch (error) {
      throw error;
    }
  }

  async handleLeaveGroup(data: unknown) {
    try {
      const validation = validateLeaveGroup(data);
      if (!validation.success) {
        console.warn(`Leave group validation failed:`, validation.error);
        throw new Error(validation.error);
      }

      const { groupId, userId } = validation.data;

      const sockets = this.connectionManager.getUserSockets(userId);
      if (!sockets) return;

      for (const socketId of sockets) {
        this.ioInstance.in(socketId).socketsLeave(groupId);
      }
    } catch (error) {
      throw error;
    }
  }

  private async handleDisconnect(socket: IOSocket) {
    const userId = this.connectionManager.getSocketUser(socket.id);
    if (!userId) return;

    try {
      await this.presenceManager.updatePresence({
        userId,
        status: "offline",
        lastSeen: new Date().toISOString(),
      });

      this.connectionManager.cleanupSocket(socket.id);
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  }

  // Redis pattern message handlers
  private async onIncomingUserMessage(message: TIncomingMessage) {
    try {
      await this.messageRouter.routeDirectMessage(message);
      
      // Update sender presence
      await this.presenceManager.updatePresence({
        userId: message.message.senderId,
        status: "online",
        lastSeen: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error handling incoming user message:', error);
    }
  }

  private async onIncomingGroupMessage(message: TIncomingMessage) {
    try {
      await this.messageRouter.routeGroupMessage(message);
      
      // Update sender presence
      await this.presenceManager.updatePresence({
        userId: message.userId,
        status: "online",
        lastSeen: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error handling incoming group message:', error);
    }
  }

  private async onIncomingAck(ack: TAckMessage) {
    try {
      await this.messageRouter.handleAcknowledgment(ack);
    } catch (error) {
      console.error('Error handling incoming ack:', error);
    }
  }

  private async onUserTyping(typing: TUserTyping) {
    try {
      await this.messageRouter.handleUserTyping(typing);
    } catch (error) {
      console.error('Error handling user typing:', error);
    }
  }

  private async broadcastPresenceUpdate(presence: TUserPresence) {
    try {
      // Get user's contacts/groups that should receive presence updates
      const cachedResult = await redis.get(redisKeys.userContacts(presence.userId));
      if (!cachedResult) {
        console.warn(`Unable to find contacts for user ${presence.userId}`);
        return;
      }

      const subscribers = JSON.parse(cachedResult) as string[];

      // Broadcast to subscribers
      for (const userId of subscribers) {
        if (presence.userId === userId) continue;

        const sockets = this.connectionManager.getUserSockets(userId);
        if (!sockets) continue;

        for (const socketId of sockets) {
          const socket = this.ioInstance.sockets.sockets.get(socketId);
          if (socket) {
            socket.emit("presence_updates", presence);
          } else {
            this.connectionManager.cleanupSocket(socketId);
          }
        }
      }

    } catch (error) {
      console.error("[broadcastPresenceUpdate] error:", error);
    }
  }

  // Public access to IO instance
  public io() {
    return this.ioInstance;
  }

  // Graceful shutdown
  public async cleanup() {
    console.info('Starting Socket Manager cleanup...');
    
    try {
      // Stop accepting new connections
      this.ioInstance.close();

      // Cleanup components
      await this.presenceManager.cleanup(),

      // Close Redis connections
      await Promise.all([
        this.redisPublisher.quit(),
        this.redisSubscriber.quit(),
        redis.quit()
      ]);

      console.info('Socket Manager cleanup completed successfully');
    } catch (error) {
      console.error('Error during Socket Manager cleanup:', error);
      throw error;
    }
  }
}

// Singleton instance management with proper cleanup
let socketManagerInstance: SocketManager | null = null;

export default function initializeSocketManager(httpServer: HttpServer): SocketManager {
  if (!socketManagerInstance) {
    socketManagerInstance = new SocketManager(httpServer);
    
    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      console.info(`Received ${signal}, initiating graceful shutdown...`);
      
      if (socketManagerInstance) {
        try {
          await socketManagerInstance.cleanup();
          socketManagerInstance = null;
          console.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          console.error('Error during graceful shutdown:', error);
          process.exit(1);
        }
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Handle uncaught exceptions and unhandled rejections
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('UNHANDLED_REJECTION');
    });
  }
  
  return socketManagerInstance;
}

export const getSocketManagerInstance = () => socketManagerInstance;