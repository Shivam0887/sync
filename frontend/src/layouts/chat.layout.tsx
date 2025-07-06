import { useCallback, useEffect, useRef, useState } from "react";

import { useIsMobile } from "@/hooks/use-mobile";
import useThrottle from "@/hooks/use-throttle";

import ChatSidebar from "@/components/chat/chat-sidebar";
import Chat from "@/components/chat/chat";

const MIN_WIDTH = 260;
const WIDTH = 320;
const MAX_WIDTH = 380;

const ChatLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(WIDTH);

  const [chatId, setChatId] = useState<string | null>(null);

  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  const isMobile = useIsMobile();

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

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleMouseDown = () => {
    dragging.current = true;
    document.body.style.cursor = "col-resize";
  };

  const onChatIdChange = useCallback((id: string) => {
    setChatId(id);
  }, []);

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
        <ChatSidebar onChatIdChange={onChatIdChange} />

        <div
          ref={handleRef}
          className="absolute w-full h-full cursor-col-resize bg-transparent hover:bg-accent transition rounded-r-2xl select-none z-0"
          onMouseDown={handleMouseDown}
          onDoubleClick={() => setSidebarWidth(WIDTH)}
        />
      </div>
      <div className="flex-1 p-3">
        <Chat
          sidebarOpen={sidebarOpen}
          toggleSidebar={toggleSidebar}
          chatId={chatId}
        />
      </div>
    </div>
  );
};

export default ChatLayout;
