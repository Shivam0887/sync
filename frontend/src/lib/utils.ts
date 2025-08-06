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
