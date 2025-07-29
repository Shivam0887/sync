import ChatHeader from "@/components/chat/chat-header";
import ChatInput from "@/components/chat/chat-input";
import ChatMessages from "@/components/chat/chat-messages";
import { toastErrorHandler } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { useChat } from "@/providers/chat-provider";
import { Search } from "lucide-react";
import { useNavigate, useOutletContext, useParams } from "react-router";

interface IOutletContext {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  onFindFriends: () => void;
}

const Chat = () => {
  const { chatId } = useParams();
  const router = useNavigate();

  const { conversation } = useChat();
  const userId = useAuth().user?.id;

  const { onFindFriends, sidebarOpen, toggleSidebar } =
    useOutletContext<IOutletContext>();

  if (!userId) {
    toastErrorHandler({ defaultErrorMsg: "Not authenticated" });
    router("/");
    return;
  }

  if (!chatId) {
    return (
      <div className="h-full w-full flex flex-col justify-center items-center gap-6">
        <div>
          <Search className="size-8 text-muted-foreground" />
        </div>
        <h1 className="text-3xl font-semibold text-center">No friends yet</h1>
        <p className="text-muted-foreground text-center max-w-xs">
          Find friends by username and start chatting!
        </p>
        <button
          className="mt-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground font-medium shadow hover:bg-primary/90 transition"
          onClick={onFindFriends}
        >
          Find Friends
        </button>
      </div>
    );
  }

  const otherUserData =
    conversation[chatId].type === "direct"
      ? conversation[chatId].participants[0].id !== userId
        ? conversation[chatId].participants[0]
        : conversation[chatId].participants[1]
      : {
          avatarUrl: conversation[chatId].avatarUrl,
          id: conversation[chatId].id,
          username: conversation[chatId].name,
        };

  return (
    <div className="h-full w-full overflow-hidden">
      <div className="flex flex-col flex-1 h-full w-full gap-y-3">
        <ChatHeader toggleSidebar={toggleSidebar} {...otherUserData} />

        <div className="flex-1 overflow-hidden rounded-xl relative shadow border">
          <div className="absolute inset-0 backdrop-blur-xl bg-secondary/50 -z-10 rounded-xl border border-border/5" />

          <ChatMessages chatId={chatId} userId={userId} />
        </div>

        <ChatInput chatId={chatId} userId={userId} id={otherUserData.id} />
      </div>
    </div>
  );
};

export default Chat;
