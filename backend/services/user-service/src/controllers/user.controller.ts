import redis from "@/config/redis-db.js";
import { db } from "@/db/index.js";
import { usersTable } from "@/db/schema.js";
import { NotFoundError } from "@shared/dist/error-handler/index.js";
import { DrizzleError, eq } from "drizzle-orm";
import { NextFunction, Request, Response } from "express";

export const userProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, (req as any).user.id));

    if (user.length === 0) {
      throw new NotFoundError("User not found");
    }

    res.status(200).json({
      user: {
        id: user[0].id,
        email: user[0].email,
        username: user[0].username,
      },
    });
  } catch (error) {
    console.error("Profile fetch error");
    next(error);
  }
};

export const updateUsername = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.id, (req as any).user.id));

    if (user.length === 0) {
      throw new NotFoundError("User not found");
    }

    const { username } = req.body as { username: string };

    await db
      .update(usersTable)
      .set({ username })
      .where(eq(usersTable.id, user[0].id));

    await redis.sadd("username", username);

    res.status(200).json({
      message: "Username updated",
    });
  } catch (error) {
    console.error("Username error");

    if (error instanceof DrizzleError) {
      console.log("Drizzle ORM error");
    }

    next(error);
  }
};
