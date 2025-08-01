import { NextFunction, Request, Response } from "express";
import { BloomFilter } from "@/lib/bloom-filter/bloom-filter.js";

import redis from "@/config/redis-db.js";

import { db } from "@/db/index.js";
import { usersTable } from "@/db/schema.js";
import { eq, like } from "drizzle-orm";
import { ConflictError } from "@shared/dist/error-handler/index.js";
import { PrefixTree } from "@/lib/prefix-search/index.js";
import { usernameSchema } from "@/controllers/auth.controller.js";

const bloomFilter = new BloomFilter(1000);

export const checkAvailableUsername = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const username = usernameSchema.parse(req.params?.username).toLowerCase();

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

export const searchUsername = (searchUsernamePrefix: PrefixTree) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const username = usernameSchema.parse(req.params?.username).toLowerCase();
      const prefixResult = searchUsernamePrefix.searchPrefix(username);

      if (prefixResult.length) {
        res.json({
          users: prefixResult,
        });
        return;
      }

      const dbResult = await db
        .select({ id: usersTable.id, username: usersTable.username })
        .from(usersTable)
        .where(like(usersTable.username, `${username}%`))
        .limit(10);

      res.json({
        users: dbResult,
      });
      return;
    } catch (error) {
      next(error);
    }
  };
};
