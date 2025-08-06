import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";

import Signup from "./signup";
import Signin from "./signin";
import { Lock, User } from "lucide-react";
import { Button } from "../ui/button";
import { useAuthModal } from "@/stores/auth-store";

const AuthModal = () => {
  const { isOpen, setAuthModalOpen, authType, setAuthType } = useAuthModal();

  let title = "Sign in to your account";
  let description = "create a new account";
  let Icon = Lock;

  if (authType === "signup") {
    title = "Create your account";
    description = "sign in to existing account";
    Icon = User;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setAuthModalOpen}>
      <DialogContent className="p-0 overflow-y-auto min-h-60 gap-0">
        <DialogHeader className="mt-6">
          <DialogTitle className="flex flex-col items-center gap-2">
            <>
              <span className="h-12 w-12 flex items-center justify-center rounded-full bg-primary/10">
                <Icon className="h-6 w-6 text-primary" />
              </span>
              <span className="text-3xl text-foreground">{title}</span>
            </>
          </DialogTitle>
          <DialogDescription className="flex justify-center">
            <span className="mt-2 text-center text-sm text-muted-foreground">
              Or{" "}
              <Button
                type="button"
                variant="link"
                onClick={() =>
                  setAuthType(authType === "signin" ? "signup" : "signin")
                }
                className="font-medium text-primary hover:text-primary/80"
              >
                {description}
              </Button>
            </span>
          </DialogDescription>
        </DialogHeader>
        <>{authType === "signup" ? <Signup /> : <Signin />}</>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;
