import "./instrument.js";

import * as Sentry from "@sentry/node";
import { env } from "@/config/env.js";

import express from "express";
import cors from "cors";
import router from "./routes/index.js";
import { errorHandler } from "@shared/dist/error-handler/error.middleware.js";

const app = express();

app.use(
  cors({
    origin: env.CORS_ORIGIN.split(","),
    allowedHeaders: ["x-forwarded-user", "authorization", "content-type"],
  }),
  express.json(),
  express.urlencoded({ extended: false })
);

app.get("/api/health", (req, res) => {
  res.status(204).end();
});

app.use("/api", router);

Sentry.setupExpressErrorHandler(app);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`User service is running at http://localhost:${env.PORT}`);
});
