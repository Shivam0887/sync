//lib/socket/index.ts
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/types/chat.types";
import { io, Socket } from "socket.io-client";

const URL = import.meta.env.VITE_API_BASE_URL as string;

export interface ExtendedConnectError extends Error {
  type?: string;
  description?: string | number;
  context?: XMLHttpRequest;
}

// Function to get current token
const getCurrentToken = () => localStorage.getItem("accessToken");

// Create socket factory function that accepts token
export const createSocket = (
  token: string | null
): Socket<ServerToClientEvents, ClientToServerEvents> => {
  return io(URL, {
    autoConnect: false,
    path: "/api/socket",
    addTrailingSlash: false,
    extraHeaders: {
      authorization: `Bearer ${token || getCurrentToken() || ""}`,
    },
    reconnectionAttempts: 5, // Increased for better reliability
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
};
