import {
  addGroupMembers,
  createGroup,
  createOrGetDirectChat,
  regenerateInviteLink,
  getConversations,
  getMessages,
  joinViaInviteLink,
  sendMessage,
} from "@/controllers/chat.controller.js";
import { Router } from "express";

const chatRouter: Router = Router();

chatRouter.get("/conversations", getConversations);

chatRouter.get("/:chatId/messages", getMessages);
chatRouter.post("/direct", createOrGetDirectChat);
chatRouter.post("/send", sendMessage);

chatRouter.post("/groups", createGroup);
chatRouter.post("/groups/:groupId/add", addGroupMembers);
chatRouter.post("/groups/:groupId/invite-link", regenerateInviteLink);
chatRouter.post("/groups/join/:inviteToken", joinViaInviteLink);

export default chatRouter;
