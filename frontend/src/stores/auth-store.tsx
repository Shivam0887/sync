import type { IAuthState, IAuthAction } from "@/types/auth.types";

import { createSelectors, toastErrorHandler } from "@/lib/utils";
import { apiRequest } from "@/services/api-request";
import { create } from "zustand";
import { format } from "date-fns";

const useAuthStoreBase = create<IAuthState & IAuthAction>()((set, get) => ({
  user: null,
  authType: "signup",
  isAuthenticated: false,
  loading: false,
  authModalOpen: false,

  setAuthType: (type) => set({ authType: type }),
  setAuthModalOpen: (isOpen) => set({ authModalOpen: isOpen }),

  clearAuth: () =>
    set({
      user: null,
      isAuthenticated: false,
      authModalOpen: false,
    }),

  signin: async (email, password) => {
    set({ loading: true });
    try {
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

      set({ user: data.user, isAuthenticated: true, authModalOpen: false });

      return { success: true, message: "Login successfully" };
    } catch (error) {
      toastErrorHandler({ error });
      return { success: false, error: "Unable to signin" };
    } finally {
      set({ loading: false });
    }
  },

  signup: async (email, username, password, confirmPassword) => {
    set({ loading: true });

    try {
      const response = await apiRequest("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password, confirmPassword }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data?.message || "Signup failed");

      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);

      set({ user: data.user, isAuthenticated: true, authModalOpen: false });

      return { success: true, message: "Account created successfully!" };
    } catch (error) {
      toastErrorHandler({ error });
      return { success: false, error: "Unable to signup" };
    } finally {
      set({ loading: false });
    }
  },

  logout: async () => {
    set({ loading: true });

    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } catch (error) {
      toastErrorHandler({ error });
    } finally {
      // Clear client-side state regardless of server response
      get().clearAuth();

      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");

      set({ loading: false });
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    set({ loading: true });

    try {
      const response = await apiRequest("/auth/change-password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Password change failed");
    } catch (error) {
      toastErrorHandler({ error });
    } finally {
      set({ loading: false });
    }
  },

  fetchUserProfile: async () => {
    set({ loading: true });

    try {
      const response = await apiRequest("/user/profile");

      if (!response.ok) throw new Error("Token validation failed");

      const data = await response.json();
      set({ user: data.user, isAuthenticated: true });
    } catch (error) {
      set({ user: null, isAuthenticated: false });
      toastErrorHandler({ error });
    } finally {
      set({ loading: false });
    }
  },

  initializeAuth: async () => {
    const storedAccessToken = localStorage.getItem("accessToken");
    const storedRefreshToken = localStorage.getItem("refreshToken");

    if (storedAccessToken && storedRefreshToken) {
      await get().fetchUserProfile();
    } else {
      set({ loading: false });
    }
  },
}));

export const useAuthStore = createSelectors(useAuthStoreBase);

export const useUser = useAuthStore.use.user;

export const useAuthActions = () => ({
  signin: useAuthStore.use.signin(),
  signup: useAuthStore.use.signup(),
  logout: useAuthStore.use.logout(),
  changePassword: useAuthStore.use.changePassword(),
  fetchUserProfile: useAuthStore.use.fetchUserProfile(),
  initializeAuth: useAuthStore.use.initializeAuth(),
});

export const useAuthStatus = () => ({
  isAuthenticated: useAuthStore.use.isAuthenticated(),
  loading: useAuthStore.use.loading(),
});

export const useAuthModal = () => ({
  isOpen: useAuthStore.use.authModalOpen(),
  authType: useAuthStore.use.authType(),
  setAuthType: useAuthStore.use.setAuthType(),
  setAuthModalOpen: useAuthStore.use.setAuthModalOpen(),
});
