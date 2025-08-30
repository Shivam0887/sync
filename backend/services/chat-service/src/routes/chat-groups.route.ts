import { Router } from "express";

import {
  addGroupMembers,
  createGroup,
  regenerateInviteLink,
  joinViaInviteLink,
  removeGroupMembers,
} from "@/controllers/chat-groups.controller.js";

const groupRouter: Router = Router();

groupRouter.post("/", createGroup);
groupRouter.post("/join/:inviteToken", joinViaInviteLink);

groupRouter.post("/:groupId/add", addGroupMembers);
groupRouter.post("/:groupId/invite-link", regenerateInviteLink);
groupRouter.delete("/:groupId/remove/:userId", removeGroupMembers);

export default groupRouter;
