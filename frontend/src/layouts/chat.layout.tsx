import type { IParticipant } from "@/types/chat.types";

import { Outlet } from "react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useIsMobile } from "@/hooks/use-mobile";
import useThrottleCallback from "@/hooks/use-throttle-callback";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import ChatSidebar from "@/components/chat/chat-sidebar";
import FindFriends from "@/components/chat/find-friends";

import { useUser } from "@/stores/auth-store";
import { useConversations } from "@/stores/chat-store";

const MIN_WIDTH = 260;
const WIDTH = 320;
const MAX_WIDTH = 380;

const ChatLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(WIDTH);

  const [findFriendsOpen, setFindFriendsOpen] = useState(false);

  const [directParticipants, setDirectParticipants] = useState<IParticipant[]>(
    []
  );

  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);

  const isDraggingRef = useRef(false);

  const user = useUser();
  const conversations = useConversations();
  const isMobile = useIsMobile();

  const handleMouseMove = (evt: MouseEvent) => {
    evt.stopPropagation();
    if (!isDraggingRef.current) return;
    const newWidth = Math.min(Math.max(evt.clientX, MIN_WIDTH), MAX_WIDTH);
    setSidebarWidth(newWidth);
  };

  const throlledHandleMove = useThrottleCallback({
    cb: handleMouseMove,
    delay: 50,
  });

  useEffect(() => {
    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.body.style.cursor = "";
    };

    document.addEventListener("mousemove", throlledHandleMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", throlledHandleMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [throlledHandleMove]);

  useCallback(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  useEffect(() => {
    // Extract and set users from conversation state
    const participants = Object.entries(conversations ?? {}).reduce(
      (result, [, c]) => {
        if (c.type === "direct") {
          const participant = c.participants.find((u) => u.id !== user?.id);

          if (participant) result.push(participant);
        }
        return result;
      },
      [] as IParticipant[]
    );

    setDirectParticipants(participants);
  }, [user, conversations]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((prev) => !prev);
  }, []);

  const handleMouseDown = () => {
    isDraggingRef.current = true;
    document.body.style.cursor = "col-resize";
  };

  const outletContext = useMemo(
    () => ({
      sidebarOpen,
      toggleSidebar,
      directParticipants,
      onFindFriends: () => setFindFriendsOpen(true),
    }),
    [sidebarOpen, directParticipants, toggleSidebar, setFindFriendsOpen]
  );

  return (
    <div className="relative h-full w-full flex">
      {isMobile ? (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left">
            <SheetHeader>
              <SheetTitle />
            </SheetHeader>

            <ChatSidebar
              onFindFriends={() => setFindFriendsOpen(true)}
              directParticipants={directParticipants}
            />
          </SheetContent>
        </Sheet>
      ) : (
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
            directParticipants={directParticipants}
          />

          <div
            ref={handleRef}
            className="absolute w-full h-full cursor-col-resize bg-transparent hover:bg-accent transition rounded-r-2xl select-none z-0"
            onMouseDown={handleMouseDown}
            onDoubleClick={() => setSidebarWidth(WIDTH)}
          />
        </div>
      )}

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
