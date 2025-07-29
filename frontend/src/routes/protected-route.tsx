import { useAuth } from "@/providers/auth-provider";
import { useEffect } from "react";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading, setAuthModalOpen, needsUsername } =
    useAuth();

  useEffect(() => {
    if (!isAuthenticated || (isAuthenticated && needsUsername)) {
      setAuthModalOpen(true);
    }
  }, [isAuthenticated, loading, setAuthModalOpen, needsUsername]);

  return !isAuthenticated || needsUsername ? null : children;
};

export default ProtectedRoute;
