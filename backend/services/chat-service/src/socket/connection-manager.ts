export interface IConnectionManager {
  mapUserSocket(socketId: string, userId: string): void;
  getUserSockets(userId: string): Set<string> | undefined;
  cleanupSocket(socketId: string): void;
  getConnectedUsers(): string[];
  getSocketUser(socketId: string): string | undefined;
  getConnectionCount(): number;
}

export class ConnectionManager implements IConnectionManager {
  private readonly userToSockets = new Map<string, Set<string>>();
  private readonly socketToUser = new Map<string, string>();
  private readonly maxConnectionsPerUser: number;

  constructor(maxConnectionsPerUser = 5) {
    this.maxConnectionsPerUser = maxConnectionsPerUser;
  }

  mapUserSocket(socketId: string, userId: string) {
    // Check connection limits
    const currentConnections = this.userToSockets.get(userId)?.size || 0;
    if (currentConnections >= this.maxConnectionsPerUser) {
      throw new Error(
        `User ${userId} exceeded maximum connections (${this.maxConnectionsPerUser})`
      );
    }

    this.socketToUser.set(socketId, userId);

    if (!this.userToSockets.has(userId)) {
      this.userToSockets.set(userId, new Set());
    }
    this.userToSockets.get(userId)!.add(socketId);
  }

  getUserSockets(userId: string) {
    return this.userToSockets.get(userId);
  }

  getSocketUser(socketId: string) {
    return this.socketToUser.get(socketId);
  }

  cleanupSocket(socketId: string) {
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

  getConnectedUsers(): string[] {
    return Array.from(this.userToSockets.keys());
  }

  getConnectionCount() {
    return this.socketToUser.size;
  }
}
