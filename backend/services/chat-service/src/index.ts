import { env } from "./config/env.js";

import cors from "cors";
import * as z from "zod/v4-mini";
import express from "express";
import { createServer } from "http";

import router from "./routes/index.js";

import initializeSocketManager from "./socket/socket-manager.js";

import { AuthError } from "@shared/dist/error-handler/index.js";
import { errorHandler } from "@shared/dist/error-handler/error.middleware.js";

const app = express();
const httpServer = createServer(app);

const decodedUserSchema = z.object({
  id: z.string({ error: "user id is missing" }),
  email: z.email({ error: "user email is missing" }),
});

const internalEndPoints = [
  { path: /\/chat\/.*\/connections/, allowedMethods: ["POST"] },
];

const socketManagerInstance = initializeSocketManager(httpServer);

app.use(
  cors({
    origin: [env.CORS_ORIGIN],
    allowedHeaders: ["x-forwarded-user", "authorization", "content-type"],
  }),
  express.json(),
  express.urlencoded({ extended: false })
);

app.get("/api/health", (req, res) => {
  res.status(204).end();
});

app.use(
  "/api",
  (req, res, next) => {
    if (
      internalEndPoints.some(
        ({ path, allowedMethods }) =>
          path.test(req.path) && allowedMethods.includes(req.method)
      )
    ) {
      next();
      return;
    }

    try {
      const decoded = req.headers["x-forwarded-user"];
      if (!decoded) throw new AuthError();

      (req as any).user = decodedUserSchema.parse(
        JSON.parse(decoded as string)
      );

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

process.on("SIGINT", socketManagerInstance.cleanup);
process.on("SIGTERM", socketManagerInstance.cleanup);
