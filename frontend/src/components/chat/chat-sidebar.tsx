import type { IUser } from "@/layouts/chat.layout";

import { Link } from "react-router";
import { useState } from "react";

import { format } from "date-fns";
import {
  Search,
  MessageCircle,
  UsersRound,
  UserRound,
  RefreshCcw,
} from "lucide-react";

import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import ChatSidebarSkeleton from "../skeleton-loading/chat-sidebar-skeleton";
import Settings from "../settings";
import CreateGroupDialog from "./create-group-modal";
import { useUser } from "@/stores/auth-store";
import { useChatLoading, useConversations } from "@/stores/chat-store";
import { Badge } from "../ui/badge";
import { useSocket } from "@/providers/socket-provider";

interface ChatSidebarProps {
  onFindFriends: () => void;
  allUsers: IUser;
}

const ChatSidebar = ({ onFindFriends, allUsers }: ChatSidebarProps) => {
  const [query, setQuery] = useState("");
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);

  const conversation = useConversations();
  const { socketConnectionStatus } = useSocket();
  const { isCoversationLoading } = useChatLoading();
  const user = useUser();

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

        <div className="flex items-center gap-4">
          <Badge variant="outline" className="p-2">
            <div
              className={`h-[8px] w-[8px] rounded-full ${
                socketConnectionStatus === "connected"
                  ? "bg-green-400"
                  : socketConnectionStatus === "disconnected"
                  ? "bg-red-400"
                  : "bg-blue-400"
              }`}
            />
            <span className="text-xs capitalize">{socketConnectionStatus}</span>
            {socketConnectionStatus === "reconnecting" && (
              <span>
                <RefreshCcw className="animate-spin size-3" />
              </span>
            )}
          </Badge>

          <Settings />
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            name="search conversation"
            placeholder="Search conversations..."
            className="pl-8 bg-background border-input focus:border-primary/30 text-foreground placeholder:text-muted-foreground focus-visible:ring-ring/20 rounded-lg h-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto hide-scrollbar px-2">
        <div className="px-4 pt-4 pb-2 flex justify-between items-center">
          <h2 className="font-medium text-xs uppercase tracking-wider text-muted-foreground">
            Messages
          </h2>

          <div className="space-x-2">
            {/* Create new groups */}
            <Button
              size="icon"
              type="button"
              variant="outline"
              onClick={() => setGroupDialogOpen(true)}
              className="h-6 w-6 rounded-full"
            >
              <UsersRound size={14} />
            </Button>

            {/* Find new friends */}
            <Button
              type="button"
              onClick={onFindFriends}
              variant="outline"
              size="icon"
              className="h-6 w-6 rounded-full"
            >
              <UserRound size={14} />
            </Button>
          </div>
        </div>
        <ul className="space-y-1">
          {isCoversationLoading ? (
            <ChatSidebarSkeleton />
          ) : (
            <>
              {Object.keys(conversation).map((id) => {
                const otherUser =
                  conversation[id].type === "direct"
                    ? conversation[id].participants[0].id !== user?.id
                      ? conversation[id].participants[0]
                      : conversation[id].participants[1]
                    : { ...conversation[id], username: conversation[id].name };

                return (
                  <div key={id}>
                    <Link
                      to={`/chat/${id}`}
                      className="flex items-center p-2 w-full rounded-lg hover:bg-sidebar-accent transition-colors"
                    >
                      <div className="relative">
                        <Avatar className="h-10 w-10 border border-sidebar-border">
                          <AvatarImage src={otherUser.avatarUrl ?? ""} />
                          <AvatarFallback>
                            {otherUser.username[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="ml-3 text-left flex-1 overflow-hidden">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm truncate text-sidebar-foreground capitalize">
                            {otherUser.username}
                          </span>
                          {conversation[id].timestamp && (
                            <span className="text-xs text-muted-foreground">
                              {format(conversation[id].timestamp, "h:mm a")}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground truncate">
                            {conversation[id].lastMessage}
                          </p>
                          {conversation[id].unread > 0 && (
                            <span className="ml-1 bg-primary text-primary-foreground font-medium text-xs rounded-full h-5 w-5 inline-flex items-center justify-center px-1.5">
                              {conversation[id].unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </>
          )}
        </ul>
      </div>

      {groupDialogOpen && (
        <CreateGroupDialog
          open={groupDialogOpen}
          onClose={() => setGroupDialogOpen(false)}
          allUsers={allUsers}
        />
      )}
    </div>
  );
};

export default ChatSidebar;
