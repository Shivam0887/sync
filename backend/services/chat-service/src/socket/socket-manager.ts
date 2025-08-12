import type { IMessage, IOServer, IOSocket } from "@/types/index.js";
import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { env } from "@/config/env.js";
import redis from "@/config/redis-db.js";
import z from "zod";
import { v7 as uuidv7 } from "uuid";

const payloadSchema = z.object({
  chatId: z.string(),
  message: z.custom<IMessage>().optional(),
  messageId: z.string().optional(),
  status: z.enum(["DELIVERED", "READ"]).optional(),
});

class SocketManager {
  private ioInstance: IOServer;
  private readonly sub = redis;
  private readonly pub = redis.duplicate();

  private readonly userToSockets = new Map<string, Set<string>>();
  private readonly socketToUser = new Map<string, string>();
  private readonly groupToUsersLocal = new Map<string, Set<string>>();
  private readonly subscribedUserIds = new Set<string>();
  private readonly subscribedGroupIds = new Set<string>();
  private redisListenerInitialized = false;

  constructor(httpServer: HttpServer) {
    this.ioInstance = new Server(httpServer, {
      cors: { origin: [env.CORS_ORIGIN] },
      path: "/api/socket",
      addTrailingSlash: false,
    });

    this.initializeRedisListener();
    this.setupConnectionHandling();
  }

  private initializeRedisListener() {
    if (this.redisListenerInitialized) return;
    this.redisListenerInitialized = true;

    this.sub.on("message", async (channel: string, raw: string) => {
      try {
        const parsed = JSON.parse(raw);
        const { chatId, message, status, messageId } =
          payloadSchema.parse(parsed);

        if (channel.startsWith("u:") && message) {
          const targetUserId = channel.slice(2);
          await this.handleIncomingUserMessage(targetUserId, chatId, message);
        } else if (channel.startsWith("g:") && message) {
          const groupId = channel.slice(2);
          await this.handleIncomingGroupMessage(groupId, message);
        } else if (channel.startsWith("ack:") && status && messageId) {
          const senderUserId = channel.slice(4);
          await this.handleIncomingAck(senderUserId, chatId, messageId, status);
        } else {
          console.warn("Unknown redis channel:", channel);
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

        this.trackSocketConnection(socket.id, userId);
        await this.subscribeUserId(userId); // Subscribe to user channels
        this.setupSocketHandlers(socket); // Set up event handlers for the socket
      } catch (err) {
        console.error("Connection error:", err);
        socket.disconnect();
      }
    });
  }

  private trackSocketConnection(socketId: string, userId: string) {
    this.socketToUser.set(socketId, userId);

    if (!this.userToSockets.has(userId)) {
      this.userToSockets.set(userId, new Set());
    }
    this.userToSockets.get(userId)!.add(socketId);
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
    const users = this.groupToUsersLocal.get(groupId);
    if (users && users.size > 0) return;

    const channel = `g:${groupId}`;
    if (this.subscribedGroupIds.has(groupId)) {
      await this.sub.unsubscribe(channel);
      this.subscribedGroupIds.delete(groupId);
    }
  }

  private async handleIncomingUserMessage(
    userId: string,
    chatId: string,
    message: IMessage
  ) {
    const sockets = this.userToSockets.get(userId);
    if (!sockets) return; // User is not connected -> Offline

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

  private async handleIncomingGroupMessage(chatId: string, message: IMessage) {
    const members = this.groupToUsersLocal.get(chatId);
    if (!members) return;

    for (const userId of members) {
      if (userId === message.senderId) continue;

      const sockets = this.userToSockets.get(userId);
      if (!sockets) continue; // User is not connected -> Offline

      for (const socketId of sockets) {
        const socket = this.ioInstance.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit("receive_message", chatId, message, () => {});
        } else {
          this.cleanupSocket(socketId);
        }
      }
    }
  }

  private async handleIncomingAck(
    senderUserId: string,
    chatId: string,
    messageId: string,
    status: "DELIVERED" | "READ"
  ) {
    const sockets = this.userToSockets.get(senderUserId);
    if (!sockets) return;

    for (const socketId of sockets) {
      const socket = this.ioInstance!.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit("message_status", chatId, messageId, status);
      } else {
        this.cleanupSocket(socketId);
      }
    }
  }

  private setupSocketHandlers(socket: IOSocket) {
    socket
      .on("send_message", this.handleSendMessage.bind(this))
      .on("message_status", this.handleMessageStatusChange.bind(this))
      .on("disconnect", this.handleDisconnect.bind(this, socket));
    //   .on("join_group", this.handleJoinGroup.bind(this, socket))
    //   .on("leave_group", this.handleLeaveGroup.bind(this, socket))
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
  //   private async handleJoinGroup(
  //     socket: IOSocket,
  //     groupId: string,
  //     ack: (response: { ok: boolean; error?: string }) => void
  //   ) {
  //     try {
  //       const userId = this.socketToUser.get(socket.id);
  //       if (!userId) throw new Error("User not identified");

  //       if (!this.groupToUsersLocal.has(groupId)) {
  //         this.groupToUsersLocal.set(groupId, new Set());
  //       }
  //       this.groupToUsersLocal.get(groupId)!.add(userId);

  //       await this.subscribeGroupChannel(groupId);
  //       ack({ ok: true });
  //     } catch (err) {
  //       ack({ ok: false, error: err.message });
  //     }
  //   }

  //   private async handleLeaveGroup(
  //     socket: IOSocket,
  //     groupId: string,
  //     ack: (response: { ok: boolean; error?: string }) => void
  //   ) {
  //     try {
  //       const userId = this.socketToUser.get(socket.id);
  //       if (!userId) throw new Error("User not identified");

  //       const members = this.groupToUsersLocal.get(groupId);
  //       if (members) {
  //         members.delete(userId);
  //         if (members.size === 0) {
  //           this.groupToUsersLocal.delete(groupId);
  //           await this.unsubscribeGroupChannel(groupId);
  //         }
  //       }
  //       ack({ ok: true });
  //     } catch (err) {
  //       ack({ ok: false, error: err.message });
  //     }
  //   }

  private async handleDisconnect(socket: IOSocket, reason: string) {
    console.log("Socket disconnected:", socket.id);
    const userId = this.socketToUser.get(socket.id);
    if (!userId) return;

    this.cleanupSocket(socket.id);

    // Clean user subscriptions if no sockets left
    if (!this.userToSockets.get(userId)?.size) {
      await this.unsubscribeUserId(userId);
    }

    // Clean group subscriptions
    for (const [groupId, members] of this.groupToUsersLocal) {
      if (members.has(userId)) {
        members.delete(userId);
        if (members.size === 0) {
          this.groupToUsersLocal.delete(groupId);
          await this.unsubscribeGroupId(groupId);
        }
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
