import type {
  User,
  IAuthModalState,
  IAuthModalAction,
} from "@/types/auth.types";

import { apiRequest } from "@/services/api-request";
import { format } from "date-fns";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { create } from "zustand";
import { toastErrorHandler } from "@/lib/utils";

interface Signup {
  email: string;
  password: string;
  username: string;
  confirmPassword: string;
}

export const authQueryKeys = {
  user: ["user"] as const,
};

export const authMutationKeys = {
  signin: ["signin"] as const,
  signup: ["signup"] as const,
  logout: ["logout"] as const,
};

export const userQueryOptions = queryOptions({
  queryKey: authQueryKeys.user,
  queryFn: async () => {
    const response = await apiRequest("/user/profile");
    const data = await response.json();

    if (!response.ok)
      throw new Error(data?.message ?? "Token validation failed");

    return data.user as User;
  },
  enabled:
    !!localStorage.getItem("accessToken") &&
    !!localStorage.getItem("refreshToken"),
  staleTime: Infinity,
  refetchOnMount: false,
  refetchOnReconnect: false,
  refetchOnWindowFocus: false,
});

export const useAuthModal = create<IAuthModalState & IAuthModalAction>()(
  (set) => ({
    authType: "signup",
    authModalOpen: false,

    setAuthModalOpen: (open: boolean) => {
      set({ authModalOpen: open });
    },

    setAuthType: (type) => {
      set({ authType: type });
    },
  })
);

export const useUser = (enabled = false) =>
  useQuery({
    ...userQueryOptions,
    enabled: enabled && userQueryOptions.enabled,
  });

export const useAuthActions = () => {
  const queryClient = useQueryClient();
  const { setAuthModalOpen } = useAuthModal();

  const signin = useMutation({
    mutationKey: authMutationKeys.signin,
    mutationFn: async ({
      email,
      password,
    }: Pick<Signup, "email" | "password">) => {
      const response = await apiRequest("/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 429) {
          const resetAt = response.headers.get("x-ratelimit-reset");
          let message = data.message as string;

          if (resetAt) {
            message += `. \nRetry after ${format(
              new Date(Number(resetAt)),
              "dd/MM/yy hh:mm:ss aa"
            )}`;
          }
          throw new Error(message);
        } else throw new Error(data?.message || "Login failed");
      }

      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);

      return data.user as User;
    },
    onError: (error) => {
      toastErrorHandler({ error });
    },
    onSuccess: (user) => {
      queryClient.setQueryData(authQueryKeys.user, () => user);
      setAuthModalOpen(false);
    },
  });

  const signup = useMutation({
    mutationKey: authMutationKeys.signup,
    mutationFn: async ({
      email,
      password,
      confirmPassword,
      username,
    }: Signup) => {
      const response = await apiRequest("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password, confirmPassword }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data?.message || "Signup failed");

      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);

      return data.user as User;
    },
    onError: (error) => {
      toastErrorHandler({ error });
    },
    onSuccess: (user) => {
      queryClient.setQueryData(authQueryKeys.user, () => user);
      setAuthModalOpen(false);
    },
  });

  const logout = useMutation({
    mutationKey: authMutationKeys.logout,
    mutationFn: async () => {
      await apiRequest("/auth/logout", { method: "POST" });
    },
    onSettled: () => {
      queryClient.setQueryData(["user"], () => null);

      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
    },
  });

  return { signin, signup, logout };
};
