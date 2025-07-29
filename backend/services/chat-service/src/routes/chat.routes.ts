import {
  createOrGetDirectChat,
  getConversations,
  getMessages,
  sendMessage,
} from "@/controllers/chat.controller.js";
import { Router } from "express";

const chatRouter: Router = Router();

chatRouter.get("/conversations", getConversations);

chatRouter.get("/:chatId/messages", getMessages);
chatRouter.post("/direct", createOrGetDirectChat);
chatRouter.post("/send", sendMessage);

export default chatRouter;
