import AuthModal from "@/components/auth/auth-modal";
import { ThemeProvider } from "@/hooks/use-theme";
import { Outlet } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import { useEffect } from "react";
import { useAuthActions } from "@/stores/auth-store";

const RootLayout = () => {
  const { initializeAuth } = useAuthActions();
  useEffect(() => {
    (async () => {
      await initializeAuth();
    })();
  }, [initializeAuth]);

  return (
    <ThemeProvider>
      <div className="h-dvh w-dvw overflow-hidden">
        <Outlet />
        <AuthModal />
      </div>
      <Toaster position="top-center" />
    </ThemeProvider>
  );
};

export default RootLayout;
