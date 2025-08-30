import { toast } from "sonner";
import { useEffect } from "react";
import { Outlet } from "react-router";

import { Toaster } from "@/components/ui/sonner";
import AuthModal from "@/components/auth/auth-modal";

import { ThemeProvider } from "@/hooks/use-theme";
import useNetworkChange from "@/hooks/use-network-change";

import { SocketProvider } from "@/providers/socket-provider";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { toastErrorHandler } from "@/lib/utils";
import { queryClient } from "@/lib/query-client";

const RootLayout = () => {
  const { isOnline, offlineCount } = useNetworkChange();

  useEffect(() => {
    if (!isOnline) {
      queryClient.cancelQueries();

      toastErrorHandler({
        defaultErrorMsg:
          "Unable to connect. Please check your internet connection.",
      });
    }

    if (offlineCount && isOnline) {
      toast.success("Back online");
    }

    queryClient.setDefaultOptions({
      queries: {
        enabled: isOnline,
      },
    });
  }, [isOnline, offlineCount]);

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
