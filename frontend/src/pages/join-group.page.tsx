import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { toastErrorHandler } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/services/api-request";
import { useUser } from "@/stores/auth-store";
import { useChatActions } from "@/stores/chat-store";

const JoinGroupPage = () => {
  const { inviteToken } = useParams<{ inviteToken: string }>();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const navigate = useNavigate();
  const user = useUser();
  const { addMembers } = useChatActions();

  useEffect(() => {
    const joinGroup = async () => {
      try {
        const res = await apiRequest(`/chat/groups/join/${inviteToken}`, {
          method: "POST",
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.message ?? "Invalid or expired invite link");
        }

        const member = user!;

        setStatus("success");
        addMembers(data.groupId, [{ ...member, role: "member" }]);
        navigate(`/chat/${data.groupId}`);
      } catch (error) {
        toastErrorHandler({ error });
        setStatus("error");
      }
    };

    if (inviteToken && user) joinGroup();
  }, [inviteToken, navigate, user, addMembers]);

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center">
      {status === "loading" && (
        <>
          <Loader2 className="animate-spin mb-2" size={32} />
          <div>Joining group...</div>
        </>
      )}
      {status === "error" && (
        <div className="text-destructive">
          Failed to join group. The invite link may be invalid or expired.
        </div>
      )}
    </div>
  );
};

export default JoinGroupPage;
