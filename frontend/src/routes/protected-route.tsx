import { useAuthModal, useUser } from "@/stores/auth-store";
import { useEffect } from "react";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { data: user, isLoading } = useUser(true);
  const { setAuthModalOpen } = useAuthModal();

  useEffect(() => {
    setAuthModalOpen(!user && !isLoading);
  }, [user, isLoading, setAuthModalOpen]);

  return !user ? null : children;
};

export default ProtectedRoute;
