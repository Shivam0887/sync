import {
  addGroupMembers,
  createGroup,
  createOrGetDirectChat,
  regenerateInviteLink,
  getConversations,
  getMessages,
  joinViaInviteLink,
  sendMessage,
  getUserGroups,
  removeGroupMembers,
  getUserPresence,
} from "@/controllers/chat.controller.js";
import { Router } from "express";

const chatRouter: Router = Router();

chatRouter.get("/conversations", getConversations);

chatRouter.get("/:chatId/messages", getMessages);
chatRouter.post("/direct", createOrGetDirectChat);
chatRouter.post("/send", sendMessage);

chatRouter.get("/groups/:userId", getUserGroups);
chatRouter.get("/:userId/presence", getUserPresence);

chatRouter.post("/groups", createGroup);
chatRouter.post("/groups/:groupId/add", addGroupMembers);

chatRouter.delete("/groups/:groupId/remove/:userId", removeGroupMembers);

chatRouter.post("/groups/:groupId/invite-link", regenerateInviteLink);
chatRouter.post("/groups/join/:inviteToken", joinViaInviteLink);

export default chatRouter;
