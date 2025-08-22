import { env } from "./config/env.js";

import express from "express";
import router from "./routes/index.js";
import cors from "cors";

import { createServer } from "http";

import { AuthError } from "@shared/dist/error-handler/index.js";
import { errorHandler } from "@shared/dist/error-handler/error.middleware.js";
import initializeSocketManager from "./socket/socket-manager.js";

const app = express();
const httpServer = createServer(app);

const internalEndPoints = [
  { path: /\/chat\/groups\/.*/, allowedMethods: ["GET"] },
];

initializeSocketManager(httpServer);

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
