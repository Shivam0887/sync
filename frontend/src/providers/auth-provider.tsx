import { toastErrorHandler } from "@/lib/utils";
import type {
  Auth,
  AuthAction,
  AuthResponseStatus,
  AuthState,
} from "@/types/auth.types";
import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useState,
} from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

const initialState: AuthState = {
  user: null,
  loading: true,
  authModalOpen: false,
};

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case "SET_USER":
      return { ...state, user: action.payload };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_AUTH_MODAL":
      return { ...state, authModalOpen: action.payload };
    case "UPDATE_USERNAME":
      return {
        ...state,
        user:
          state.user === null
            ? null
            : { ...state.user, username: action.payload },
      };
    case "LOGOUT":
      return { ...state, user: null };
    default:
      return state;
  }
};

const authContextState: Auth = {
  user: null,
  loading: false,
  isAuthenticated: false,
  signup: async () => ({ success: false, error: "" }),
  signin: async () => ({ success: false, error: "" }),
  logout: async () => {},
  changePassword: async () => ({ success: false }),
  apiRequest: async () => new Response(null, { status: 500 }),
  authModalOpen: false,
  setAuthModalOpen: () => {},
  needsUsername: false,
  onSignUpSuccess: () => {},
};

const AuthContext = createContext<Auth>(authContextState);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const [needsUsername, setNeedsUsername] = useState(false);
  const accessTokenRef = useRef<string | null>(null);
  const refreshTokenRef = useRef<string | null>(null);

  const setAuthModalOpen = useCallback((isOpen: boolean) => {
    dispatch({ type: "SET_AUTH_MODAL", payload: isOpen });
  }, []);

  const apiRequest = useCallback(async (url: string, options?: RequestInit) => {
    let response = await fetch(`${API_BASE_URL}${url}`, {
      headers: {
        Authorization: accessTokenRef.current
          ? `Bearer ${accessTokenRef.current}`
          : "",
        "Content-Type": "application/json",
      },
      ...options,
    });

    if (response.status === 401 && refreshTokenRef.current) {
      try {
        const refreshResponse = await fetch(
          `${API_BASE_URL}/auth/refresh-token`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ refreshToken: refreshTokenRef.current }),
          }
        );

        if (!refreshResponse.ok) throw new Error("Session expired");

        const refreshData = await refreshResponse.json();
        accessTokenRef.current = refreshData.accessToken;
        refreshTokenRef.current = refreshData.refreshToken;
        localStorage.setItem("accessToken", refreshData.accessToken);
        localStorage.setItem("refreshToken", refreshData.refreshToken);

        response = await fetch(`${API_BASE_URL}${url}`, {
          headers: {
            Authorization: `Bearer ${refreshData.accessToken}`,
            "Content-Type": "application/json",
          },
          ...options,
        });
      } catch (refreshError) {
        dispatch({ type: "LOGOUT" });
        toastErrorHandler({ error: refreshError });
      }
    }

    return response;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } catch (error) {
      toastErrorHandler({ error });
    } finally {
      dispatch({ type: "LOGOUT" });
      accessTokenRef.current = null;
      refreshTokenRef.current = null;
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");

      location.replace("/");
    }
  }, [apiRequest]);

  const signin = useCallback(
    async (email: string, password: string): Promise<AuthResponseStatus> => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/signin`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || "Login failed");
        }

        accessTokenRef.current = data.accessToken;
        refreshTokenRef.current = data.refreshToken;

        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);

        dispatch({ type: "SET_USER", payload: data.user });
        setAuthModalOpen(false);

        return { success: true, message: "Login successfully" };
      } catch (error) {
        toastErrorHandler({ error });
        return { success: false, error: "Unable to signin" };
      }
    },
    [setAuthModalOpen]
  );

  const signup = useCallback(
    async (
      email: string,
      password: string,
      confirmPassword: string
    ): Promise<AuthResponseStatus> => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/signup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email, password, confirmPassword }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.message || "Signup failed");
        }

        accessTokenRef.current = data.accessToken;
        refreshTokenRef.current = data.refreshToken;

        localStorage.setItem("needsUsername", "true");
        localStorage.setItem("accessToken", data.accessToken);
        localStorage.setItem("refreshToken", data.refreshToken);

        dispatch({ type: "SET_USER", payload: data.user });
        setAuthModalOpen(false);
        setNeedsUsername(true);

        return { success: true, message: "Account created successfully!" };
      } catch (error) {
        toastErrorHandler({ error });
        return { success: false, error: "Unable to signup" };
      }
    },
    [setAuthModalOpen]
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      try {
        const response = await apiRequest("/auth/change-password", {
          method: "PUT",
          body: JSON.stringify({ currentPassword, newPassword }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Password change failed");
        }

        return { success: true };
      } catch (error) {
        console.error(error);
        return { success: false };
      }
    },
    [apiRequest]
  );

  const onSignUpSuccess = useCallback((username: string) => {
    setNeedsUsername(false);
    dispatch({ type: "UPDATE_USERNAME", payload: username });
    localStorage.setItem("needsUsername", "false");
  }, []);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await apiRequest("/user/profile", { method: "GET" });

        if (!response.ok) {
          throw new Error("Token validation failed");
        }

        const data = await response.json();
        dispatch({ type: "SET_USER", payload: data.user });
      } catch (error) {
        console.error("Profile fetch error:", error);
        dispatch({ type: "LOGOUT" });
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    };

    const initializeAuth = async () => {
      const storedAccessToken = localStorage.getItem("accessToken");
      const storedRefreshToken = localStorage.getItem("refreshToken");

      if (storedAccessToken && storedRefreshToken) {
        accessTokenRef.current = storedAccessToken;
        refreshTokenRef.current = storedRefreshToken;
        await fetchUserProfile();
      } else {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    };

    initializeAuth();
    setNeedsUsername(localStorage.getItem("needsUsername") === "true");
  }, [apiRequest]);

  const contextValue = useMemo(
    () => ({
      user: state.user,
      loading: state.loading,
      isAuthenticated: !!state.user,
      signin,
      signup,
      logout,
      changePassword,
      apiRequest,
      authModalOpen: state.authModalOpen,
      setAuthModalOpen,
      needsUsername,
      onSignUpSuccess,
    }),
    [
      state.user,
      state.loading,
      state.authModalOpen,
      signin,
      signup,
      logout,
      changePassword,
      apiRequest,
      setAuthModalOpen,
      needsUsername,
      onSignUpSuccess,
    ]
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
