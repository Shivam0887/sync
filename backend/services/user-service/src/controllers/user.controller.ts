import redis from "@/config/redis-db.js";
import { db } from "@/db/index.js";
import { usersTable } from "@/db/schema.js";
import { PrefixTree } from "@/lib/prefix-search/index.js";
import { NotFoundError } from "@shared/dist/error-handler/index.js";
import { eq } from "drizzle-orm";
import { NextFunction, Request, Response } from "express";
import { usernameSchema } from "./auth.controller.js";
import { IUser } from "@/types/index.js";
import { redisKeys } from "@/lib/utils/index.js";

export const userProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = (req as any).user.id;
    const user = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        username: usersTable.username,
        avatarUrl: usersTable.avatarUrl,
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    if (user.length === 0) {
      throw new NotFoundError(`User id: ${userId} not found`);
    }

    res.json({
      user: user[0],
    });
  } catch (error) {
    console.error("Profile fetch error");
    next(error);
  }
};

export const updateUsername =
  (searchUsernamePrefix: PrefixTree<IUser>) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.id;

      const user = await db
        .select({
          avatarUrl: usersTable.avatarUrl,
          prevUsername: usersTable.username,
        })
        .from(usersTable)
        .where(eq(usersTable.id, userId));

      if (user.length === 0) {
        throw new NotFoundError(`User id: ${userId} not found`);
      }

      const username = usernameSchema
        .parse(req.params.username)
        .trim()
        .toLowerCase();

      await db
        .update(usersTable)
        .set({ username })
        .where(eq(usersTable.id, userId));

      await redis.srem(redisKeys.username(), user[0].prevUsername);
      await redis.sadd(redisKeys.username(), username);

      searchUsernamePrefix.delete(user[0].prevUsername);
      searchUsernamePrefix.insert(username, {
        username,
        id: userId,
        avatarUrl: user[0].avatarUrl,
      });

      res.json({
        message: "Username updated",
      });
    } catch (error) {
      console.error("[Username update] error");
      next(error);
    }
  };
