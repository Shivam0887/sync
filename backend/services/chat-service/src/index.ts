import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "./types/index.js";

import { env } from "./config/env.js";

import express from "express";
import router from "./routes/index.js";
import cors from "cors";

import { createServer } from "http";
import { Server } from "socket.io";

import { nanoid } from "nanoid";
import { AuthError } from "@shared/dist/error-handler/index.js";
import { errorHandler } from "@shared/dist/error-handler/error.middleware.js";

const app = express();
const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: [env.CORS_ORIGIN],
  },
  path: "/api/socket",
  addTrailingSlash: false,
});

io.on("connection", (socket) => {
  socket.on("send_message", (chatId, message) => {
    const msg = { ...message, id: nanoid() };
    console.log({ msg });
    socket.broadcast.emit("receive_message", chatId, msg);
  });
});

app.use(
  cors({
    origin: [env.CORS_ORIGIN],
    allowedHeaders: ["x-forwarded-user", "authorization", "content-type"],
  }),
  express.json(),
  express.urlencoded({ extended: false })
);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    message: "Chat service is running",
    timestamp: new Date().toISOString(),
  });
});

app.use(
  "/api",
  (req, res, next) => {
    try {
      const decoded = req.headers["x-forwarded-user"];
      if (!decoded) throw new AuthError();

      (req as any).user = JSON.parse(decoded as string);

      next();
    } catch (error) {
      next(error);
    }
  },
  router
);

app.use(errorHandler);

httpServer.listen(env.PORT, () => {
  console.log(`Chat service listening at PORT ${env.PORT}`);
});
