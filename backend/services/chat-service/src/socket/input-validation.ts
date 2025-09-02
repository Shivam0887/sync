import {
  joinGroupSchema,
  leaveGroupSchema,
  messageStatusSchema,
  messageDataSchema,
  userTypingSchema,
} from "@/lib/zod-schemas/socket-data.schema.js";
import { TMessageData, TMessageStatus, TUserTyping, TJoinGroup, TLeaveGroup } from "@/types/socket.types.js";

type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// Input Validator with comprehensive validation
export const validateSendMessage = (data: unknown): ValidationResult<TMessageData> => {
  const { error, data: value } = messageDataSchema.safeParse(data);
  if (error) {
    return { success: false, error: `Send message validation failed: ${error.message}` };
  }
  return { success: true, data: value };
};

export const validateMessageStatus = (data: unknown): ValidationResult<TMessageStatus> => {
  const { error, data: value } = messageStatusSchema.safeParse(data);
  if (error) {
    return { success: false, error: `Message status validation failed: ${error.message}` };
  }
  return { success: true, data: value };
};

export const validateUserTyping = (data: unknown): ValidationResult<TUserTyping> => {
  const { error, data: value } = userTypingSchema.safeParse(data);
  if (error) {
    return { success: false, error: `User typing validation failed: ${error.message}` };
  }
  return { success: true, data: value };
};

export const validateJoinGroup = (data: unknown): ValidationResult<TJoinGroup> => {
  const { error, data: value } = joinGroupSchema.safeParse(data);
  if (error) {
    return { success: false, error: `Join group validation failed: ${error.message}` };
  }
  return { success: true, data: value };
};

export const validateLeaveGroup = (data: unknown): ValidationResult<TLeaveGroup> => {
  const { error, data: value } = leaveGroupSchema.safeParse(data);
  if (error) {
    return { success: false, error: `Leave group validation failed: ${error.message}` };
  }
  return { success: true, data: value };
};
