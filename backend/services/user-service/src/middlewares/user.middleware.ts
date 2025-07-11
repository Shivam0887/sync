import { z } from "zod";
import { NextFunction, Request, Response } from "express";
import { BloomFilter } from "@/lib/bloom-filter/bloom-filter.js";

import redis from "@/config/redis-db.js";

import { db } from "@/db/index.js";
import { usersTable } from "@/db/schema.js";
import { eq } from "drizzle-orm";
import { ConflictError } from "@shared/dist/error-handler/index.js";

const usernameSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, { message: "Username must be at least 3 characters" })
    .max(255, { message: "Username can't be greater than 255 characters" }),
});

const bloomFilter = new BloomFilter(1000);

export const checkAvailableUsername = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { username } = usernameSchema.parse(req.body);

    if (!bloomFilter.has(username)) {
      bloomFilter.add(username);
      next();
      return;
    }

    const isUsernameExists = Boolean(
      await redis.sismember("sync_username", username)
    );

    if (isUsernameExists) {
      throw new ConflictError("Username already exists");
    }

    const isUserExists =
      (
        await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.username, username))
      ).length === 1;

    if (isUserExists) {
      throw new ConflictError("Username already exists");
    }

    next();
  } catch (error) {
    console.log("Check username availability error");
    next(error);
  }
};
