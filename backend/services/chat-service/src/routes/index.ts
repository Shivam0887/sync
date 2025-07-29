import { Router } from "express";
import chatRouter from "./chat.routes.js";

const router: Router = Router();

router.use("/chat", chatRouter);

export default router;
