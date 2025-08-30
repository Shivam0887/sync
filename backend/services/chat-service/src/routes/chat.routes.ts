import { Router } from "express";

import {
  createOrGetDirectChat,
  getConversations,
  getMessages,
  getUserPresence,
  updateUserConnections,
} from "@/controllers/chat.controller.js";
import groupRouter from "./chat-groups.route.js";

const chatRouter: Router = Router();

chatRouter.get("/conversations", getConversations);

chatRouter.get("/:chatId/messages", getMessages);
chatRouter.post("/:otherUserId/direct", createOrGetDirectChat);

// Update the cache list of direct and group chats for an authenticated user
chatRouter.post("/:userId/converations", updateUserConnections);

chatRouter.get("/:userId/presence", getUserPresence);

chatRouter.get("/groups", groupRouter);

export default chatRouter;
