import "./instrument.js";

import * as Sentry from "@sentry/node";
import { env } from "@/config/env.js";

import express from "express";
import cors from "cors";
import router from "./routes/index.js";
import { errorHandler } from "@shared/dist/error-handler/error.middleware.js";
import { AuthError } from "@shared/src/error-handler/index.js";

const app = express();

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
    message: "User service is running",
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

Sentry.setupExpressErrorHandler(app);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`User service is running at http://localhost:${env.PORT}`);
});
