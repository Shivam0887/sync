// backend/user-service/src/index.ts

import { env } from "@/config/env.js";

import express, { NextFunction, Response, type Request } from "express";
import cors from "cors";
import router from "./routes/index.js";

const app = express();

app.use(
  cors({
    origin: "*",
    allowedHeaders: ["x-forwarded-user", "authorization", "content-type"],
  }),
  express.json(),
  express.urlencoded({ extended: false })
);

app.get("/api/health", (req, res) => {
  res.status(200).json({ message: "User service is running 😎" });
});

app.use(
  "/api",
  (req, res, next) => {
    const decoded = req.headers["x-forwarded-user"];
    if (decoded) {
      (req as any).user = JSON.parse(decoded as string);
    }
    next();
  },
  router
);

app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof Error) {
    console.log("Error:", err.message, err.name);
  }
});

app.listen(env.PORT, () => {
  console.log(`User service is running at http://localhost:${env.PORT}`);
});
