import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { useAuth } from "@/providers/auth-provider";
import { toastErrorHandler } from "@/lib/utils";
import { Loader2 } from "lucide-react";

const JoinGroupPage = () => {
  const { inviteToken } = useParams<{ inviteToken: string }>();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const { apiRequest } = useAuth();
  const navigate = useNavigate();

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

        setStatus("success");
        navigate(`/chat/${data.groupId}`);
      } catch (error) {
        toastErrorHandler({ error });
        setStatus("error");
      }
    };

    if (inviteToken) joinGroup();
  }, [inviteToken, apiRequest, navigate]);

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
