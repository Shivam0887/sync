export type AuthType = "signup" | "signin";

export type AuthResponseStatus =
  | { success: true; message: string }
  | { success: false; error: string };

export type User = {
  id: string;
  email: string;
  username: string;
} | null;

export type Auth = {
  user: User;
  loading: boolean;
  isAuthenticated: boolean;
  signin: (email: string, password: string) => Promise<AuthResponseStatus>;
  signup: (
    email: string,
    password: string,
    confirmPassword: string
  ) => Promise<AuthResponseStatus>;
  logout: () => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ success: boolean }>;
  apiRequest: (url: string, options?: RequestInit) => Promise<Response>;
  authModalOpen: boolean;
  setAuthModalOpen: (isOpen: boolean) => void;
  needsUsername: boolean;
  onSignUpSuccess: (username: string) => void;
};

export type AuthState = {
  user: User;
  loading: boolean;
  authModalOpen: boolean;
};

export type AuthAction =
  | { type: "SET_USER"; payload: User }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_AUTH_MODAL"; payload: boolean }
  | { type: "LOGOUT" }
  | { type: "UPDATE_USERNAME"; payload: string };
