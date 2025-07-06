import { useAuth } from "@/providers/auth-provider";
import { lazy, useState, Suspense } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";

import type { AuthType } from "@/types/auth.types";
import Loader from "../loader";

const Signup = lazy(() => import("./signup"));
const Signin = lazy(() => import("./signin"));
const Username = lazy(() => import("./username"));

const AuthModal = () => {
  const [authType, setAuthType] = useState<AuthType>("signup");
  const { authModalOpen, setAuthModalOpen, isAuthenticated, needsUsername } =
    useAuth();

  const isRegistered = isAuthenticated && needsUsername;

  return (
    <Dialog open={authModalOpen} onOpenChange={setAuthModalOpen}>
      <DialogHeader>
        <DialogTitle />
        <DialogDescription />
      </DialogHeader>
      <DialogContent className="p-0 overflow-y-auto min-h-60">
        <Suspense fallback={<Loader />}>
          {isRegistered ? (
            <Username />
          ) : (
            <>
              {authType === "signup" ? (
                <Signup setAuthType={setAuthType} />
              ) : (
                <Signin setAuthType={setAuthType} />
              )}
            </>
          )}
        </Suspense>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;
