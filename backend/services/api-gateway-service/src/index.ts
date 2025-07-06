import "./instrument";

import * as Sentry from "@sentry/node";
import { env } from "./config/env.js";
import { errorHandler } from "@shared/error-handler/error.middleware";

import cors from "cors";
import helmet from "helmet";
import express from "express";

import router from "./routes/index.js";
import { authenticateToken } from "./middlewares";

const app = express();

app.use(
  cors({
    origin: [env.CORS_ORIGIN],
  }),
  helmet()
);

app.use(authenticateToken);

app.use("/api", router);

// The error handler must be registered before any other error middleware and after all controllers
Sentry.setupExpressErrorHandler(app);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`API gateway service is running at http://localhost:${env.PORT}`);
});
