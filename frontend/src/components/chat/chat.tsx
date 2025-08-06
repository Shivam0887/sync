import ChatHeader from "@/components/chat/chat-header";
import ChatInput from "@/components/chat/chat-input";
import ChatMessages from "@/components/chat/chat-messages";
import { toastErrorHandler } from "@/lib/utils";
import { useUser } from "@/stores/auth-store";
import { useConversations } from "@/stores/chat-store";
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

  const conversation = useConversations();
  const user = useUser();

  const { onFindFriends, toggleSidebar } = useOutletContext<IOutletContext>();

  if (!user) {
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

  if (!conversation[chatId]) return null;

  const receiverId =
    conversation[chatId].type === "direct"
      ? conversation[chatId].participants[0].id !== user.id
        ? conversation[chatId].participants[0].id
        : conversation[chatId].participants[1].id
      : null;

  return (
    <div className="h-full w-full overflow-hidden pl-1 pr-2">
      <div className="flex flex-col flex-1 h-full w-full gap-y-2">
        <ChatHeader
          userId={user.id}
          toggleSidebar={toggleSidebar}
          conversationData={conversation[chatId]}
        />

        <div className="flex-1 overflow-hidden rounded-xl relative shadow border">
          <ChatMessages chatId={chatId} userId={user.id} />
        </div>

        <ChatInput
          chatId={chatId}
          userId={user.id}
          conversationType={conversation[chatId].type}
          receiverId={receiverId}
        />
      </div>
    </div>
  );
};

export default Chat;
