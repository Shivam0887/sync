// backend/user-service/src/routes/index.ts

import { Router } from "express";
import authRouter from "./auth.route.js";
import userRouter from "./user.route.js";

const router: Router = Router();

router.use("/auth", authRouter);
router.use("/user", userRouter);

export default router;
