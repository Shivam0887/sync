export type AuthType = "signup" | "signin";

export type AuthResponseStatus =
  | { success: true; message: string }
  | { success: false; error: string };

export type User = {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
};

// export type Auth = {
//   user: User;
//   authType: AuthType;
//   setAuthType: React.Dispatch<React.SetStateAction<AuthType>>;
//   loading: boolean;
//   isAuthenticated: boolean;
//   signin: (email: string, password: string) => Promise<AuthResponseStatus>;
//   signup: (
//     email: string,
//     username: string,
//     password: string,
//     confirmPassword: string
//   ) => Promise<AuthResponseStatus>;
//   logout: () => Promise<void>;
//   changePassword: (
//     currentPassword: string,
//     newPassword: string
//   ) => Promise<{ success: boolean }>;
//   apiRequest: (url: string, options?: RequestInit) => Promise<Response>;
//   authModalOpen: boolean;
//   setAuthModalOpen: (isOpen: boolean) => void;
// };

export type IAuthState = {
  user: User | null;
  loading: boolean;
  authModalOpen: boolean;
  isAuthenticated: boolean;
  authType: AuthType;
};

export interface IAuthAction {
  setAuthType: (type: IAuthState["authType"]) => void;
  setAuthModalOpen: (isOpen: boolean) => void;
  signin: (email: string, password: string) => Promise<AuthResponseStatus>;
  signup: (
    email: string,
    username: string,
    password: string,
    confirmPassword: string
  ) => Promise<AuthResponseStatus>;
  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<void>;
  fetchUserProfile: () => Promise<void>;
  initializeAuth: () => Promise<void>;
  clearAuth: () => void;
  logout: () => Promise<void>;
}

// export type AuthAction =
//   | { type: "SET_USER"; payload: User }
//   | { type: "SET_LOADING"; payload: boolean }
//   | { type: "SET_AUTH_MODAL"; payload: boolean }
//   | { type: "LOGOUT" }
//   | { type: "UPDATE_USERNAME"; payload: string };
