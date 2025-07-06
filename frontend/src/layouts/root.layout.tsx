import AuthModal from "@/components/auth/auth-modal";
import { ThemeProvider } from "@/hooks/use-theme";
import { AuthProvider } from "@/providers/auth-provider";
import { Outlet } from "react-router";
import { Toaster } from "@/components/ui/sonner";

const RootLayout = () => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <div className="h-dvh w-dvw overflow-hidden">
          <Outlet />
          <AuthModal />
        </div>
        <Toaster position="top-center" />
      </ThemeProvider>
    </AuthProvider>
  );
};

export default RootLayout;
