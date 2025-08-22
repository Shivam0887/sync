import type { Conversation, IParticipant } from "@/types/chat.types";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Menu, Search, Phone, Video, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { ProfileInfo } from "./profile-info";
import { GroupInfo } from "./group-info";
import { useUserActions, useUserPresence } from "@/stores/chat-store";
import { apiRequest } from "@/services/api-request";
import { formatLastSeen } from "@/lib/utils";

type ChatHeaderProps = {
  toggleSidebar: () => void;
  conversationData: Conversation;
  userId: string;
};

const userPresenceSet = new Set<string>(); // Keep track of user presence so we can fetch only once

const ChatHeader = ({
  toggleSidebar,
  userId,
  conversationData,
}: ChatHeaderProps) => {
  const [openProfile, setOpenProfile] = useState(false);
  const { updateUserPresence } = useUserActions();

  let avatarUrl = "";
  let name = "";

  let otherUser: IParticipant | null = null;

  if (conversationData.type === "direct") {
    otherUser =
      conversationData.participants[0].id !== userId
        ? conversationData.participants[0]
        : conversationData.participants[1];

    avatarUrl = otherUser.avatarUrl ?? "";
    name = otherUser.username;
  } else {
    avatarUrl = conversationData.avatarUrl ?? "";
    name = conversationData.name;
  }

  const otherUserId = otherUser?.id ?? "";
  const presence = useUserPresence(otherUserId);

  useEffect(() => {
    const fetchUserPresence = async (userId: string) => {
      try {
        const response = await apiRequest(`/chat/${userId}/presence`);
        if (!response.ok) throw new Error("[User Presence] error");
        const { data } = await response.json();

        if (data) {
          userPresenceSet.add(userId);
          updateUserPresence(data.userId, data.status, data.lastSeen);
        }
      } catch (error) {
        console.error(error);
      }
    };

    if (otherUserId && !userPresenceSet.has(otherUserId)) {
      fetchUserPresence(otherUserId);
    }
  }, [otherUserId, updateUserPresence]);

  const handleProfileClick = () => {
    setOpenProfile(!openProfile);
  };

  return (
    <header className="border px-4 py-3 bg-sidebar text-sidebar-foreground rounded-xl relative overflow-hidden flex items-center justify-between shadow">
      <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-primary to-transparent"></div>

      <div className="flex items-center">
        <Button
          onClick={toggleSidebar}
          variant="ghost"
          size="sm"
          className="mr-3 md:mr-2 text-foreground/80 hover:text-foreground hover:bg-white/5 relative"
        >
          <Menu size={18} />
          <span className="absolute -right-0.5 -top-0.5 w-1.5 h-1.5 rounded-full animate-pulse"></span>
        </Button>
        <div
          className="flex items-center cursor-pointer"
          onClick={handleProfileClick}
        >
          <div className="relative">
            <Avatar className="h-9 w-9 border border-white/10 ring-2 ring-ring/20">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback>
                {name[0].toUpperCase() + name[1].toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="ml-3 hidden sm:block">
            <div className="font-medium capitalize">{name}</div>
            {presence && (
              <span className="text-xs">
                {presence.status === "offline" &&
                Date.now() - new Date(presence.lastSeen).getTime() > 60000
                  ? formatLastSeen(presence.lastSeen)
                  : presence.status}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-1">
        {/* Search within chats */}
        <Button
          variant="ghost"
          size="icon"
          className="rounded-lg h-9 w-9 text-foreground/70 hover:text-foreground hover:bg-white/5 relative group"
        >
          <Search size={18} />
          <span className="absolute inset-0 rounded-lg bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></span>
        </Button>

        {/* Voice call button */}
        <Button
          variant="ghost"
          size="icon"
          className="rounded-lg h-9 w-9 text-foreground/70 hover:text-foreground hover:bg-white/5 relative group"
        >
          <Phone size={18} />
          <span className="absolute inset-0 rounded-lg bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></span>
        </Button>

        {/* Video call button */}
        <Button
          variant="ghost"
          size="icon"
          className="rounded-lg h-9 w-9 text-foreground/70 hover:text-foreground hover:bg-white/5 relative group"
        >
          <Video size={18} />
          <span className="absolute inset-0 rounded-lg bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></span>
        </Button>

        {/* More options */}
        <Button
          variant="ghost"
          size="icon"
          className="rounded-lg h-9 w-9 text-foreground/70 hover:text-foreground hover:bg-white/5 relative group"
        >
          <MoreHorizontal size={18} />
          <span className="absolute inset-0 rounded-lg bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></span>
        </Button>
      </div>

      {conversationData.type === "direct" ? (
        <ProfileInfo
          onClose={handleProfileClick}
          user={otherUser!}
          open={openProfile}
        />
      ) : (
        <GroupInfo
          onClose={handleProfileClick}
          group={conversationData}
          open={openProfile}
        />
      )}
    </header>
  );
};

export default ChatHeader;
