import { useAuthModal, useAuthStatus } from "@/stores/auth-store";
import { useEffect } from "react";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuthStatus();
  const { setAuthModalOpen } = useAuthModal();

  useEffect(() => {
    if (!isAuthenticated && !loading) {
      setAuthModalOpen(true);
    }
  }, [isAuthenticated, loading, setAuthModalOpen]);

  return !isAuthenticated ? null : children;
};

export default ProtectedRoute;
