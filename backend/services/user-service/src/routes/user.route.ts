import { Router } from "express";
import { updateUsername, userProfile } from "@/controllers/user.controller.js";
import { checkAvailableUsername } from "@/middlewares/user.middleware.js";

const userRouter: Router = Router();

userRouter.get("/profile", userProfile);
userRouter.patch("/update-username", checkAvailableUsername, updateUsername);

export default userRouter;
