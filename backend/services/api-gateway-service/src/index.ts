import "./instrument"; // Sentry must be initialized first!

import express from "express";
import * as Sentry from "@sentry/node";
import { env } from "./config/env.js";
import { errorHandler } from "@shared/dist/error-handler/error.middleware";
import cors from "cors";
import helmet from "helmet";
import router from "./routes/index.js";
import { authenticateToken } from "./middlewares";

const app = express();

app.use(cors({ origin: [env.CORS_ORIGIN] }), helmet());

app.use(authenticateToken);

app.use((req, res, next) => {
  if (req.headers["x-forwarded-user"]) {
    const user = JSON.parse(req.headers["x-forwarded-user"] as string);
    Sentry.setUser({
      id: user.id,
      email: user.email,
    });
  }
  next();
});

app.use("/api", router);

Sentry.setupExpressErrorHandler(app);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`API gateway service is running at http://localhost:${env.PORT}`);
});
