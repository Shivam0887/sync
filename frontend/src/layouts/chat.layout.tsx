import type { IConversationBase } from "@/types/chat.types";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useIsMobile } from "@/hooks/use-mobile";
import useThrottle from "@/hooks/use-throttle";

import ChatSidebar from "@/components/chat/chat-sidebar";
import FindFriends from "@/components/chat/find-friends";
import { Outlet } from "react-router";
import { useConversations, useSocket } from "@/stores/chat-store";
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
  const { initializeSocket, cleanupSocket } = useSocket();
  const conversations = useConversations();

  const handleMouseMove = (evt: MouseEvent) => {
    evt.stopPropagation();
    if (!dragging.current) return;
    const newWidth = Math.min(Math.max(evt.clientX, MIN_WIDTH), MAX_WIDTH);
    setSidebarWidth(newWidth);
  };

  const throlledHandleMove = useThrottle({
    isFunc: true,
    cb: handleMouseMove,
    delay: 50,
  });

  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
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

  useEffect(() => {
    if (user) initializeSocket();

    return () => {
      cleanupSocket();
    };
  }, [user, initializeSocket, cleanupSocket]);

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
