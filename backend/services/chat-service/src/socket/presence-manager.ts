import { LRUCache } from "lru-cache";
import { ConnectionManager } from "./connection-manager.js";
import { CircuitBreaker } from "@shared/dist/circuit-breaker/index.js";

import { Redis } from "ioredis";
import { redisKeys, redisPubSubKeys } from "@/lib/utils/index.js";

import { db } from "@/db/index.js";
import { sql } from "drizzle-orm";
import { userStatusTable } from "@/db/schema.js";
import { PublishPattern } from "./socket-manager.js";
import { TUserPresence } from "@/types/socket.types.js";

interface IPresenceManager {
  updatePresence(presence: TUserPresence): Promise<void>;
  getPresence(userId: string): TUserPresence | undefined;
  startMonitoring(): void;
  stopMonitoring(): void;
  cleanup(): Promise<void>;
}

type TPresenceUpdate = Omit<TUserPresence, "lastSeen"> & { lastSeen: Date };

export class PresenceManager implements IPresenceManager {
  private readonly userPresence = new LRUCache<string, TPresenceUpdate>({
    maxSize: 10_000, // Maximum 10,000 users tracked
    ttl: 7 * 24 * 60 * 60 * 1000, // 7 days TTL
    updateAgeOnGet: true,
  });

  private presenceUpdateQueue: TPresenceUpdate[] = [];
  private monitoringTimer?: NodeJS.Timeout;
  private batchTimer?: NodeJS.Timeout;

  private readonly OFFLINE_THRESHOLD = 60 * 1000;
  private readonly AWAY_THRESHOLD = 30 * 1000;
  private readonly BATCH_INTERVAL = 10 * 1000;
  private readonly MONITORING_INTERVAL = 60 * 1000;
  private readonly MAX_BATCH_SIZE = 1000;

  private readonly dbCircuitBreaker: CircuitBreaker<typeof this.performBatchDatabaseUpdate>;

  constructor(
    private connectionManager: ConnectionManager,
    private redisPublisher: PublishPattern,
    private redis: Redis
  ) {
    this.dbCircuitBreaker = new CircuitBreaker(this.performBatchDatabaseUpdate.bind(this));

    this.setupCircuitBreakerEvents();
  }

  private setupCircuitBreakerEvents() {
    this.dbCircuitBreaker.on("open", () => {
      console.warn("Database circuit breaker opened - database operations suspended");
    });

    this.dbCircuitBreaker.on("half_open", () => {
      console.info("Database circuit breaker half-open - testing database");
    });

    this.dbCircuitBreaker.on("closed", () => {
      console.info("Database circuit breaker closed - database operations resumed");
    });
  }

  async updatePresence(presence: TUserPresence) {
    const updatedPresence = {
      ...presence,
      lastSeen: new Date(presence.lastSeen),
    };

    this.userPresence.set(updatedPresence.userId, updatedPresence);
    this.presenceUpdateQueue.push(updatedPresence);

    // Publish to Redis for real-time updates
    await this.publishPresenceUpdate(presence);
  }

  private async publishPresenceUpdate(presence: TUserPresence) {
    try {
      await this.redisPublisher(
        "presence_updates",
        redisPubSubKeys.presenceUpdates(),
        presence
      );

      // Also cache in Redis with TTL
      await this.redis.setex(
        redisKeys.userPresence(presence.userId),
        7 * 24 * 60 * 60, // 7 days TTL
        JSON.stringify({
          status: presence.status,
          lastSeen: presence.lastSeen,
        })
      );
    } catch (error) {
      console.error("Failed to publish presence update:", error);
    }
  }

  startMonitoring() {
    this.batchTimer = setInterval(() => {
      this.processBatchUpdates().catch((error) => {
        console.error("Batch processing error:", error);
      });
    }, this.BATCH_INTERVAL);

    this.monitoringTimer = setInterval(() => {
      this.watchPresenceStatus();
    }, this.MONITORING_INTERVAL);

    console.info("Presence monitoring started");
  }

  stopMonitoring() {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = undefined;
    }

    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }

    console.info("Presence monitoring stopped");
  }

  private async processBatchUpdates(): Promise<void> {
    if (this.presenceUpdateQueue.length === 0) return;

    // Process in chunks to avoid overwhelming the database
    const batchSize = Math.min(this.MAX_BATCH_SIZE, this.presenceUpdateQueue.length);

    const updates = this.presenceUpdateQueue.splice(0, batchSize);

    try {
      await this.dbCircuitBreaker.execute(updates);
    } catch (error) {
      console.error("Batch presence update failed:", error);

      // Re-queue failed updates with exponential backoff
      this.scheduleRetry(updates);
    }
  }

  private async performBatchDatabaseUpdate(updates: TPresenceUpdate[]) {
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
  }

  private scheduleRetry(updates: TPresenceUpdate[], attempt = 1) {
    const maxAttempts = 3;
    if (attempt > maxAttempts) {
      console.error(`Max retry attempts (${maxAttempts}) reached for ${updates.length} presence updates`);
      return;
    }

    const backoffDelay = Math.min(1000 * Math.pow(2, attempt), 30000);

    setTimeout(() => {
      this.performBatchDatabaseUpdate(updates).catch(() => {
        this.scheduleRetry(updates, attempt + 1);
      });
    }, backoffDelay);
  }

  private watchPresenceStatus() {
    const now = Date.now();
    const usersToUpdate: TUserPresence[] = [];

    for (const [userId, presence] of this.userPresence.entries()) {
      const timeSinceLastSeen = now - presence.lastSeen.getTime();
      const socketCount = this.connectionManager.getUserSockets(userId)?.size ?? 0;

      const newStatus = this.calculatePresenceStatus(
        presence.status,
        timeSinceLastSeen,
        socketCount
      );

      if (newStatus !== presence.status) {
        if (newStatus === "offline") {
          this.userPresence.delete(userId);
        }

        usersToUpdate.push({
          userId,
          status: newStatus,
          lastSeen: presence.lastSeen.toISOString(),
        });
      }
    }

    // Batch update all status changes
    Promise.all(
      usersToUpdate.map((update) => this.updatePresence(update))
    ).catch((error) =>
      console.error("Error updating presence statuses:", error)
    );
  }

  private calculatePresenceStatus(
    currentStatus: string,
    timeSinceLastSeen: number,
    socketCount: number
  ) {
    const isOffline =
      currentStatus !== "offline" &&
      timeSinceLastSeen > this.OFFLINE_THRESHOLD &&
      socketCount === 0;

    const isAway =
      currentStatus === "online" &&
      timeSinceLastSeen > this.AWAY_THRESHOLD &&
      socketCount > 0;

    if (isOffline) return "offline";
    if (isAway) return "away";
    return "online";
  }

  getPresence(userId: string) {
    const presence = this.userPresence.get(userId);
    if (!presence) return undefined;

    return {
      userId: presence.userId,
      status: presence.status,
      lastSeen: presence.lastSeen.toISOString(),
    };
  }

  async cleanup() {
    this.stopMonitoring();
    await this.processBatchUpdates();
    console.info("Presence manager cleanup completed");
  }
}
