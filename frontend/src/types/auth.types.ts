export type AuthType = "signup" | "signin";

export type User = {
  id: string;
  email: string;
  username: string;
  avatarUrl: string | null;
};

export type IAuthModalState = {
  authModalOpen: boolean;
  authType: AuthType;
};

export interface IAuthModalAction {
  setAuthType: (type: AuthType) => void;
  setAuthModalOpen: (isOpen: boolean) => void;
}
