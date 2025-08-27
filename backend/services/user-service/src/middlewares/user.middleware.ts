import { NextFunction, Request, Response } from "express";
import { BloomFilter } from "@/lib/bloom-filter/bloom-filter.js";

import redis from "@/config/redis-db.js";

import { db } from "@/db/index.js";
import { usersTable } from "@/db/schema.js";
import { eq, like } from "drizzle-orm";
import { ConflictError } from "@shared/dist/error-handler/index.js";
import { PrefixTree } from "@/lib/prefix-search/index.js";
import { usernameSchema } from "@/controllers/auth.controller.js";
import { IUser } from "@/types/index.js";

export const checkUsernameAvailability =
  (bloomFilter: BloomFilter, searchUsernamePrefix: PrefixTree<IUser>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const username = usernameSchema
        .parse(req.params.username)
        .trim()
        .toLowerCase();

      if (!bloomFilter.has(username)) {
        bloomFilter.add(username);
        next();
        return;
      }

      const isUsernamePrefixed = searchUsernamePrefix.search(username);

      if (isUsernamePrefixed) throw new ConflictError("Username already exists");

      const isUsernameInCache = await redis.sismember("username", username);

      if (isUsernameInCache) throw new ConflictError("Username already exists");

      const isUsernameInDB = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.username, username));

      if (isUsernameInDB.length) throw new ConflictError("Username already exists");

      next();
    } catch (error) {
      console.log("Check username availability error");
      next(error);
    }
  };

export const searchUsername =
  (searchUsernamePrefix: PrefixTree<IUser>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const username = usernameSchema
        .parse(req.params.username)
        .trim()
        .toLowerCase();

      const prefixResult = searchUsernamePrefix.startsWith(username);

      if (prefixResult.length) {
        res.json({
          users: prefixResult,
        });
        return;
      }

      const dbResult = await db
        .select({
          id: usersTable.id,
          username: usersTable.username,
          avatarUrl: usersTable.avatarUrl,
        })
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
