import type { IConversationBase } from "@/types/chat.types";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useIsMobile } from "@/hooks/use-mobile";
import useThrottleCallback from "@/hooks/use-throttle-callback";

import ChatSidebar from "@/components/chat/chat-sidebar";
import FindFriends from "@/components/chat/find-friends";
import { Outlet } from "react-router";
import { useChatActions, useConversations } from "@/stores/chat-store";
import { useUser } from "@/stores/auth-store";

const MIN_WIDTH = 260;
const WIDTH = 320;
const MAX_WIDTH = 380;

export type IUser = IConversationBase["participants"];

const ChatLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(WIDTH);

  const [allUsers, setAllUsers] = useState<IUser>([]);

  const [findFriendsOpen, setFindFriendsOpen] = useState(false);

  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  const isMobile = useIsMobile();

  const user = useUser();
  const conversations = useConversations();
  const { fetchConversations } = useChatActions();

  const handleMouseMove = (evt: MouseEvent) => {
    evt.stopPropagation();
    if (!dragging.current) return;
    const newWidth = Math.min(Math.max(evt.clientX, MIN_WIDTH), MAX_WIDTH);
    setSidebarWidth(newWidth);
  };

  const throlledHandleMove = useThrottleCallback({
    cb: handleMouseMove,
    delay: 50,
  });

  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  useEffect(() => {
    const handleMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
    };

    document.addEventListener("mousemove", throlledHandleMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", throlledHandleMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [throlledHandleMove]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    // Extract and set users from conversation state
    const participants = Object.entries(conversations).reduce(
      (result, [, c]) => {
        if (c.type === "direct") {
          result.push({
            ...c.participants.filter((u) => u.id !== user?.id)[0],
          });
        }
        return result;
      },
      [] as IUser
    );

    setAllUsers(participants);
  }, [user, conversations]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const handleMouseDown = () => {
    dragging.current = true;
    document.body.style.cursor = "col-resize";
  };

  const outletContext = useMemo(
    () => ({
      sidebarOpen,
      allUsers,
      toggleSidebar,
      onFindFriends: () => setFindFriendsOpen(true),
    }),
    [sidebarOpen, allUsers, toggleSidebar, setFindFriendsOpen]
  );

  return (
    <div className="relative h-full w-full flex">
      <div
        ref={sidebarRef}
        style={{
          width: sidebarWidth,
          minWidth: MIN_WIDTH,
          maxWidth: MAX_WIDTH,
        }}
        className={`flex h-full transition-all duration-75 ${
          !sidebarOpen ? "-translate-x-full absolute" : "translate-x-0"
        }`}
      >
        <ChatSidebar
          onFindFriends={() => setFindFriendsOpen(true)}
          allUsers={allUsers}
        />

        <div
          ref={handleRef}
          className="absolute w-full h-full cursor-col-resize bg-transparent hover:bg-accent transition rounded-r-2xl select-none z-0"
          onMouseDown={handleMouseDown}
          onDoubleClick={() => setSidebarWidth(WIDTH)}
        />
      </div>
      <div className="h-full flex-1">
        <Outlet context={outletContext} />
      </div>
      <FindFriends
        open={findFriendsOpen}
        onClose={() => setFindFriendsOpen(false)}
      />
    </div>
  );
};

export default ChatLayout;
