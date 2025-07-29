import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/types/chat.types";
import { io, Socket } from "socket.io-client";

const URL = `${import.meta.env.VITE_API_BASE_URL}/chat`;

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(
  URL,
  {
    autoConnect: false,
  }
);
