import { useEffect, useRef, useState } from "react";
import { Smile, Paperclip, Image, Mic, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useChat } from "@/providers/chat-provider";

const MAX_ROWS = 5;

interface ChatInputProps {
  chatId: string;
  userId: string;
  receiverId: string | null;
  conversationType: "direct" | "group";
}

const ChatInput = ({
  chatId,
  userId,
  receiverId,
  conversationType,
}: ChatInputProps) => {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [textareaClientHeight, setTextareaClientHeight] = useState(0); // Initial textarea client height

  const { sendMessage } = useChat();

  useEffect(() => {
    if (textareaRef.current) {
      setTextareaClientHeight(textareaRef.current.clientHeight);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      sendMessage({
        chatId,
        content: message,
        senderId: userId,
        receiverId,
        conversationType,
      });
      setMessage("");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const elem = e.target;
    setMessage(elem.value);

    const currentRows = elem.scrollHeight / textareaClientHeight;

    elem.style.height = "auto";
    elem.style.height =
      currentRows <= MAX_ROWS
        ? `${elem.scrollHeight}px`
        : `${MAX_ROWS * textareaClientHeight}px`;
  };

  return (
    <div className="w-full shadow border rounded-xl overflow-hidden ">
      <form
        onSubmit={handleSubmit}
        className="relative bg-secondary/50 flex gap-3"
      >
        {/* Content */}
        <div className="relative p-2 pb-3 w-full flex items-end gap-2">
          <div className="relative flex-1 flex gap-2 items-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-lg h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-white/10 relative group"
            >
              <Paperclip size={18} />
              <span className="absolute inset-0 rounded-lg bg-white/8 opacity-0 group-hover:opacity-100 transition-opacity"></span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-lg h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-white/10 relative group"
            >
              <Image size={18} />
              <span className="absolute inset-0 rounded-lg bg-white/8 opacity-0 group-hover:opacity-100 transition-opacity"></span>
            </Button>

            <div className="has-[>textarea:focus]:ring-2 ring-ring min-h-12 w-full rounded-xl self-center flex border border-muted-foreground/50 items-center py-1">
              <textarea
                ref={textareaRef}
                className={`w-full px-4 bg-transparent resize-none min-h-6 text-foreground outline-none placeholder:text-muted-foreground transition-all duration-200`}
                placeholder="Type a message..."
                value={message}
                onChange={handleChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                rows={1}
              />
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-lg h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-white/8"
            >
              <Smile size={18} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-lg h-9 w-9 text-muted-foreground hover:text-foreground hover:bg-white/10 relative group"
            >
              <Mic size={18} />
              <span className="absolute inset-0 rounded-lg bg-white/8 opacity-0 group-hover:opacity-100 transition-opacity"></span>
            </Button>

            <Button
              type="submit"
              size="icon"
              className="rounded-lg h-10 w-10 relative overflow-hidden disabled:opacity-50 disabled:pointer-events-none"
              disabled={!message.trim()}
            >
              <div className="absolute inset-0 bg-noise opacity-15"></div>
              <Send size={18} className="relative z-10 ml-0.5 -mt-0.5" />
              {message.trim() && (
                <span className="absolute inset-0 bg-white/15 animate-pulse"></span>
              )}
            </Button>
          </div>
        </div>
        <div className="w-2/3 absolute h-1 bg-gradient-to-r self-end from-primary/60" />
      </form>
    </div>
  );
};

export default ChatInput;
