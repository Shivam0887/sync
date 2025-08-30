import { Request, Response, Router } from "express";
import { updateUsername, userProfile } from "@/controllers/user.controller.js";
import {
  checkUsernameAvailability,
  searchUsername,
} from "@/middlewares/user.middleware.js";
import { PrefixTree } from "@/lib/prefix-search/index.js";
import { db } from "@/db/index.js";
import { usersTable } from "@/db/schema.js";
import { BloomFilter } from "@/lib/bloom-filter/bloom-filter.js";
import { IUser } from "@/types/index.js";

const userRouter: Router = Router();

const searchUsernamePrefix = new PrefixTree<IUser>();
const bloomFilter = new BloomFilter(100_000);

let isDbUserLoaded = false;

(async () => {
  if (!isDbUserLoaded) {
    isDbUserLoaded = true;

    const dbResult = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        avatarUrl: usersTable.avatarUrl,
      })
      .from(usersTable)
      .limit(10_000);

    dbResult.forEach(({ id, username, avatarUrl }) => {
      bloomFilter.add(username);
      searchUsernamePrefix.insert(username, { username, id, avatarUrl });
    });
  }
})();

userRouter.get("/profile", userProfile);

userRouter.get(
  "/username/:username/search",
  searchUsername(searchUsernamePrefix)
);

userRouter.get(
  "/username/:username/check",
  checkUsernameAvailability(bloomFilter, searchUsernamePrefix),
  (req: Request, res: Response) => {
    res.json({ message: "Username available" });
  }
);

userRouter.patch(
  "/username/:username/update",
  checkUsernameAvailability(bloomFilter, searchUsernamePrefix),
  updateUsername(searchUsernamePrefix)
);

export default userRouter;
