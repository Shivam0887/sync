import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast, type ExternalToast } from "sonner";

interface IErrorHandler {
  error?: unknown;
  defaultErrorMsg?: string;
  data?: ExternalToast;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const toastErrorHandler = ({
  error,
  defaultErrorMsg = "Something went wrong",
  data,
}: IErrorHandler) => {
  console.log(error);
  toast(error instanceof Error ? error.message : defaultErrorMsg, data);
};
