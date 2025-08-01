import { useAuth } from "@/providers/auth-provider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";

import Signup from "./signup";
import Signin from "./signin";

const AuthModal = () => {
  const { authModalOpen, setAuthModalOpen, authType, setAuthType } = useAuth();

  return (
    <Dialog open={authModalOpen} onOpenChange={setAuthModalOpen}>
      <DialogHeader>
        <DialogTitle />
        <DialogDescription />
      </DialogHeader>
      <DialogContent className="p-0 overflow-y-auto min-h-60">
        <>
          {authType === "signup" ? (
            <Signup setAuthType={setAuthType} />
          ) : (
            <Signin setAuthType={setAuthType} />
          )}
        </>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;
