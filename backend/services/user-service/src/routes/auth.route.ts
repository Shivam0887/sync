import { Router } from "express";
import {
  signup,
  logout,
  refreshToken,
  signin,
} from "@/controllers/auth.controller.js";

const authRouter: Router = Router();

authRouter.post("/signup", signup);
authRouter.post("/signin", signin);
authRouter.post("/refresh-token", refreshToken);
authRouter.post("/logout", logout);

export default authRouter;
