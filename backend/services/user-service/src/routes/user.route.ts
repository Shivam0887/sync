import { Request, Response, Router } from "express";
import { updateUsername, userProfile } from "@/controllers/user.controller.js";
import {
  checkAvailableUsername,
  searchUsername,
} from "@/middlewares/user.middleware.js";
import { PrefixTree } from "@/lib/prefix-search/index.js";
import { db } from "@/db/index.js";
import { usersTable } from "@/db/schema.js";

const userRouter: Router = Router();

let isDbUserLoaded = false;
const searchUsernamePrefix = new PrefixTree();

(async () => {
  if (!isDbUserLoaded) {
    isDbUserLoaded = true;

    const dbResult = await db
      .select({ id: usersTable.id, username: usersTable.username })
      .from(usersTable)
      .limit(100);

    dbResult.forEach(({ id, username }) => {
      searchUsernamePrefix.insert(username, id);
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
  checkAvailableUsername,
  (req: Request, res: Response) => {
    res.json({ message: "Username available" })
  }
);
userRouter.patch(
  "/username/:username/update",
  checkAvailableUsername,
  updateUsername(searchUsernamePrefix)
);

export default userRouter;
