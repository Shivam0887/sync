import type { AuthType } from "@/types/auth.types";

import { MessageCircle } from "lucide-react";
import { Button } from "./ui/button";
import ToggleTheme from "./toggle-theme";
import { useAuthActions, useAuthModal, useUser } from "@/stores/auth-store";

const Navbar = () => {
  const { data: user } = useUser();
  const { logout } = useAuthActions();
  const { setAuthType, setAuthModalOpen } = useAuthModal();

  const handleAuthClick = (authType: AuthType) => {
    setAuthType(authType);
    setAuthModalOpen(true);
  };

  return (
    <header className="relative z-10 flex items-center justify-between p-6 lg:px-8 backdrop-blur-sm">
      <div className="flex items-center space-x-3">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/25">
          <MessageCircle className="w-6 h-6 text-primary-foreground" />
        </div>
        <div className="text-foreground">
          <div className="font-bold text-lg">Sync</div>
          <div className="hidden sm:block text-xs text-muted-foreground -mt-1">
            Connect • Collaborate • Create
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        {user ? (
          <>
            <span>{user.username}</span>
            <Button onClick={() => logout.mutate()}>Logout</Button>
          </>
        ) : (
          <>
            <Button onClick={() => handleAuthClick("signin")}>Sign in</Button>
            <Button onClick={() => handleAuthClick("signup")}>Sign up</Button>
          </>
        )}
        <ToggleTheme />
      </div>
    </header>
  );
};

export default Navbar;
