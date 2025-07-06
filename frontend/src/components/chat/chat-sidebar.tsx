import { memo, useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Search, MessageCircle, Users, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import ToggleTheme from "../toggle-theme";
import { Link } from "react-router";
import { useAuth } from "@/providers/auth-provider";
import ChatSidebarSkeleton from "../skeleton-loading/chat-sidebar-skeleton";

const conversations = [
  {
    id: 1,
    name: "Sarah Johnson",
    avatar: null,
    online: true,
    unread: 2,
    lastMessage: "Hey there! How are you doing today?",
    timestamp: new Date(2025, 4, 21, 10, 30),
  },
  {
    id: 2,
    name: "Michael Smith",
    avatar: null,
    online: false,
    unread: 0,
    lastMessage: "I sent you the files",
    timestamp: new Date(2025, 4, 21, 9, 15),
  },
  {
    id: 3,
    name: "Jessica Williams",
    avatar: null,
    online: true,
    unread: 0,
    lastMessage: "Let me know what you think",
    timestamp: new Date(2025, 4, 20, 18, 45),
  },
  {
    id: 4,
    name: "David Brown",
    avatar: null,
    online: false,
    unread: 5,
    lastMessage: "Can we schedule a meeting?",
    timestamp: new Date(2025, 4, 20, 16, 22),
  },
];

const channels = [
  { id: 1, name: "General", unread: 0, members: 34 },
  { id: 2, name: "Design Team", unread: 3, members: 12 },
  { id: 3, name: "Marketing", unread: 0, members: 8 },
  { id: 4, name: "Development", unread: 12, members: 16 },
];

type Tab = "conversations" | "channels";

interface ChatSidebarProps {
  onChatIdChange: (id: string) => void;
}

const ChatSidebar = memo(({ onChatIdChange }: ChatSidebarProps) => {
  const [activeTab, setActiveTab] = useState<Tab>("conversations");
  const [query, setQuery] = useState("");

  const [isLoading, setIsLoading] = useState(true);

  const { user, logout } = useAuth();

  // Testing
  useEffect(() => {
    setTimeout(() => {
      setIsLoading(false);
    }, 3000);
  }, []);

  return (
    <div className="relative border-r z-50 flex flex-col w-[calc(100%-0.2rem)] h-full bg-sidebar text-sidebar-foreground rounded-r-2xl">
      <div className="p-4 border-b border-sidebar-border flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-lg relative overflow-hidden bg-primary">
            <MessageCircle
              size={18}
              className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-primary-foreground"
            />
          </div>
          <h1 className="text-lg font-semibold text-sidebar-foreground">
            Sync
          </h1>
        </Link>
      </div>

      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            className="pl-8 bg-background border-input focus:border-primary/30 text-foreground placeholder:text-muted-foreground focus-visible:ring-ring/20 rounded-lg h-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex px-4 py-2 space-x-1">
        <button
          className={cn(
            "flex items-center justify-center flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 relative overflow-hidden",
            activeTab === "conversations"
              ? "text-sidebar-primary bg-sidebar-accent"
              : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          )}
          onClick={() => setActiveTab("conversations")}
        >
          <MessageCircle size={16} className="mr-1.5" />
          Chats
        </button>
        <button
          className={cn(
            "flex items-center justify-center flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200 relative overflow-hidden",
            activeTab === "channels"
              ? "text-sidebar-primary bg-sidebar-accent"
              : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          )}
          onClick={() => setActiveTab("channels")}
        >
          <Users size={16} className="mr-1.5" />
          Channels
        </button>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar px-2">
        {activeTab === "conversations" ? (
          <>
            <div className="px-4 pt-4 pb-2 flex justify-between items-center">
              <h2 className="font-medium text-xs uppercase tracking-wider text-muted-foreground">
                Messages
              </h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full bg-primary/10 hover:bg-primary/20 text-primary"
              >
                <Plus size={14} />
              </Button>
            </div>
            <ul className="space-y-1">
              {isLoading ? (
                <ChatSidebarSkeleton />
              ) : (
                <>
                  {conversations.map((convo) => (
                    <li key={convo.id}>
                      <button
                        onClick={() => onChatIdChange(convo.id.toString())}
                        className="flex items-center p-2 w-full rounded-lg hover:bg-sidebar-accent transition-colors"
                      >
                        <div className="relative">
                          <Avatar className="h-10 w-10 border border-sidebar-border">
                            <div className="bg-primary/10 h-full w-full flex items-center justify-center text-base font-medium text-primary">
                              {convo.name.charAt(0)}
                            </div>
                          </Avatar>
                          {convo.online && (
                            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-sidebar" />
                          )}
                        </div>
                        <div className="ml-3 text-left flex-1 overflow-hidden">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm truncate text-sidebar-foreground">
                              {convo.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(convo.timestamp, "h:mm a")}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground truncate">
                              {convo.lastMessage}
                            </p>
                            {convo.unread > 0 && (
                              <span className="ml-1 bg-primary text-black text-xs rounded-full h-5 min-w-5 inline-flex items-center justify-center px-1.5">
                                {convo.unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  ))}
                </>
              )}
            </ul>
          </>
        ) : (
          <>
            <div className="px-4 pt-4 pb-2 flex justify-between items-center">
              <h2 className="font-medium text-xs uppercase tracking-wider text-muted-foreground">
                Channels
              </h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 rounded-full bg-primary/10 hover:bg-primary/20 text-primary"
              >
                <Plus size={14} />
              </Button>
            </div>
            <ul className="space-y-1">
              {channels.map((channel) => (
                <li key={channel.id}>
                  <button className="flex items-center p-2 w-full rounded-lg hover:bg-sidebar-accent transition-colors">
                    <div className="h-10 w-10 rounded-md bg-sidebar-accent mr-3 flex items-center justify-center">
                      <span className="text-lg font-semibold text-primary">
                        #
                      </span>
                    </div>
                    <div className="flex-1 text-left overflow-hidden">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-sidebar-foreground">
                          {channel.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {channel.members} members
                        </span>
                      </div>
                      {channel.unread > 0 && (
                        <div className="flex items-center mt-0.5">
                          <span className="bg-primary text-primary-foreground text-xs rounded-full h-5 min-w-5 inline-flex items-center justify-center px-1.5">
                            {channel.unread}
                          </span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            new messages
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="flex items-center justify-between p-3 border-t border-sidebar-border">
        <button className="flex items-center rounded-lg hover:bg-sidebar-accent p-2 transition-colors">
          <Avatar className="h-9 w-9 border border-sidebar-border">
            <div className="bg-primary/10 h-full w-full flex items-center justify-center text-base font-medium text-primary">
              {user ? user.username[0].toUpperCase() : ""}
            </div>
          </Avatar>
          <div className="ml-3 text-left">
            <div className="font-medium text-sm text-sidebar-foreground">
              {user?.username}
            </div>
          </div>
        </button>
        <button onClick={logout}>Logout</button>
        <ToggleTheme />
      </div>
    </div>
  );
});

ChatSidebar.displayName = "ChatSidebar";

export default ChatSidebar;
