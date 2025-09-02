import { IOServer, TUserTyping } from "@/types/socket.types.js";
import { TAckMessage, TIncomingMessage } from "@/types/redis.types.js";

import { LRUCache } from "lru-cache";
import { ConnectionManager } from "./connection-manager.js";

import { redisPubSubKeys } from "@/lib/utils/index.js";
import { PublishPattern } from "./socket-manager.js";

interface IMessageRouter {
  routeDirectMessage(message: TIncomingMessage): Promise<void>;
  routeGroupMessage(message: TIncomingMessage): Promise<void>;
  handleAcknowledgment(ack: TAckMessage): Promise<void>;
  handleUserTyping(typing: TUserTyping): Promise<void>;
}

export class MessageRouter implements IMessageRouter {
  public readonly readCountPerGroup = new LRUCache<string, Set<string>>({
    maxSize: 50_000, // Track read counts for 50k messages
    ttl: 24 * 60 * 60 * 1000, // 24 hours TTL
  });

  constructor (
    private connectionManager: ConnectionManager, 
    private ioInstance: IOServer, 
    private redisPublisher: PublishPattern, 
  ) {}

  async routeDirectMessage({
    chatId,
    message,
    userId,
  }: TIncomingMessage) {
    const sockets = this.connectionManager.getUserSockets(userId);
    if (!sockets || sockets.size === 0) {
      return; // User is offline
    }

    const messageId = message.id;

    const messageDelivered = async () => {
      await this.publishAcknowledgment({
        chatId,
        userId: message.senderId,
        messageId,
        status: "DELIVERED",
      });
    };

    try {
      const socketPromises: Promise<void>[] = [];

      for (const socketId of sockets) {
        const socket = this.ioInstance.sockets.sockets.get(socketId);

        if (socket) {
          const promise = new Promise<void>((resolve, reject) => {
            socket
              .timeout(3000)
              .emit("receive_message", { chatId, message }, (err) => {
                if (err) {
                  console.warn(`[receive_message] emit error for socket ${socketId}:`, err.message);
                  reject(err);
                } else {
                  resolve();
                }
              });
          });

          socketPromises.push(promise);
        } else {
          this.connectionManager.cleanupSocket(socketId);
        }
      }

      // Wait for at least one successful delivery
       await Promise.any(socketPromises);
       await messageDelivered();
    } catch (error) {
      console.error("Error routing direct message:", error);
    }
  }

  async routeGroupMessage({
    chatId,
    message,
    userId,
  }: TIncomingMessage) {
    const senderSockets = this.connectionManager.getUserSockets(userId);
    let ackCount = 0;

    const messageDelivered = async () => {
      await this.publishAcknowledgment({
        chatId,
        userId: message.senderId,
        messageId: message.id,
        status: "DELIVERED",
      });
    };

    try {
      await new Promise<void>((resolve, reject) => {
        this.ioInstance
          .to(chatId)
          .except(senderSockets ? Array.from(senderSockets) : [])
          .timeout(3000)
          .emit("receive_message", { chatId, message }, (err) => {
            if (err) {
              reject(err);
            } else {
              ackCount++;
              if (ackCount === 1) {
                messageDelivered().then(resolve).catch(reject);
              } else {
                resolve();
              }
            }
          });
      });
    } catch (error) {
      console.error("Error routing group message:", error);
    }
  }

  async handleAcknowledgment(data: TAckMessage) {
    const { userId, ...messageStatus } = data;

    const sockets = this.connectionManager.getUserSockets(data.userId);
    if (!sockets) return;

    for (const socketId of sockets) {
      const socket = this.ioInstance.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit("message_status", messageStatus);
      } else {
        this.connectionManager.cleanupSocket(socketId);
      }
    }
  }

  async handleUserTyping(data: TUserTyping) {
    const sockets = this.connectionManager.getUserSockets(data.userId);
    if (!sockets) return;

    for (const socketId of sockets) {
      const socket = this.ioInstance.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit("user_typing", data);
      } else {
        this.connectionManager.cleanupSocket(socketId);
      }
    }
  }

  private async publishAcknowledgment(data: TAckMessage) {
    try {
      await this.redisPublisher(
        "ack:*",
        redisPubSubKeys.ackChannel(data.userId),
        data
      );
    } catch (error) {
      console.error("Failed to publish acknowledgment:", error);
    }
  }
}
