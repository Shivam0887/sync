import AuthModal from "@/components/auth/auth-modal";
import { ThemeProvider } from "@/hooks/use-theme";
import { Outlet } from "react-router";
import { Toaster } from "@/components/ui/sonner";
import { useEffect } from "react";
import { useAuthActions } from "@/stores/auth-store";
import { SocketProvider } from "@/providers/socket-provider";
import { queryClient } from "@/lib/query-client";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

const RootLayout = () => {
  const { initializeAuth } = useAuthActions();
  useEffect(() => {
    (async () => {
      await initializeAuth();
    })();
  }, [initializeAuth]);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <SocketProvider>
          <div className="h-dvh w-dvw overflow-hidden">
            <Outlet />
            <AuthModal />
          </div>
          <Toaster position="top-center" />
        </SocketProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ThemeProvider>
  );
};

export default RootLayout;
