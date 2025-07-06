import ChatHeader from "@/components/chat/chat-header";
import ChatInput from "@/components/chat/chat-input";
import ChatMessages from "@/components/chat/chat-messages";

interface ChatProps {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  chatId: string | null;
}

const Chat = ({ chatId, sidebarOpen, toggleSidebar }: ChatProps) => {
  return (
    <div className="h-full w-full overflow-hidden">
      {chatId === null ? (
        <div className="h-full w-full flex justify-center items-center">
          <h1 className="text-5xl font-semibold text-center">
            Start your first chat now
          </h1>
          <p></p>
        </div>
      ) : (
        <div className="flex flex-col flex-1 h-full w-full gap-y-3">
          <ChatHeader toggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />

          <div className="flex-1 overflow-hidden rounded-xl relative shadow border">
            <div className="absolute inset-0 backdrop-blur-xl bg-secondary/50 -z-10 rounded-xl border border-border/5" />

            <ChatMessages chatId={chatId} />
          </div>

          <ChatInput />
        </div>
      )}
    </div>
  );
};

export default Chat;
