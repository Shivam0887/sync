import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast, type ExternalToast } from "sonner";
import type { StoreApi, UseBoundStore } from "zustand";

interface IErrorHandler {
  error?: unknown;
  defaultErrorMsg?: string;
  data?: ExternalToast;
}

type WithSelectors<S> = S extends { getState: () => infer T }
  ? S & { use: { [K in keyof T]: () => T[K] } }
  : never;

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const toastErrorHandler = ({
  error,
  defaultErrorMsg = "Something went wrong",
  data,
}: IErrorHandler) => {
  toast(error instanceof Error ? error.message : defaultErrorMsg, data);
};

export const createSelectors = <S extends UseBoundStore<StoreApi<object>>>(
  _store: S
) => {
  const store = _store as WithSelectors<typeof _store>;
  store.use = {};
  for (const k of Object.keys(store.getState())) {
    (store.use as any)[k] = () => store((s) => s[k as keyof typeof s]);
  }

  return store;
};

export const formatLastSeen = (dateInput: string) => {
  const date = new Date(dateInput);
  const now = new Date();

  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const isYesterday = (d1: Date, d2: Date) => {
    const yesterday = new Date(d2);
    yesterday.setDate(d2.getDate() - 1);
    return isSameDay(d1, yesterday);
  };

  const getWeekday = (d: Date) =>
    d.toLocaleDateString("en-US", { weekday: "long" });

  const formatTime = (d: Date) =>
    d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

  if (isSameDay(date, now)) {
    // Today → show only time
    return `Today at ${formatTime(date)}`;
  } else if (isYesterday(date, now)) {
    // Yesterday → show yesterday + time
    return `Yesterday at ${formatTime(date)}`;
  } else if (date > new Date(now.setDate(now.getDate() - 7))) {
    // Within last 7 days → show weekday + time
    return `${getWeekday(date)} at ${formatTime(date)}`;
  } else {
    // Older → show full date
    return date.toLocaleDateString("en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
};
