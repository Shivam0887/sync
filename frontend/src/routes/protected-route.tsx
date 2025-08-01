import { useAuth } from "@/providers/auth-provider";
import { useEffect } from "react";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading, setAuthModalOpen } = useAuth();

  useEffect(() => {
    if (!isAuthenticated && !loading) {
      setAuthModalOpen(true);
    }
  }, [isAuthenticated, loading, setAuthModalOpen]);

  return !isAuthenticated ? null : children;
};

export default ProtectedRoute;
