import type { Message } from "@/types/chat.types";
import type { EmojiClickData } from "emoji-picker-react";

import { nanoid } from "nanoid";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useSocketActions } from "@/providers/socket-provider";

import { Button } from "@/components/ui/button";
import { Smile, Paperclip, Image, Mic } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import Loader from "@/components/loader";

import useDebounceCallback from "@/hooks/use-debounce-callback";

const MAX_ROWS = 5;

interface ChatInputProps {
  chatId: string;
  userId: string;
  receiverId: string | null;
  conversationType: "direct" | "group";
}

const Picker = lazy(() => import("@/components/emoji-picker"));

const ChatInput = ({
  chatId,
  userId,
  receiverId,
  conversationType,
}: ChatInputProps) => {
  const [content, setContent] = useState("");
  const [textareaClientHeight, setTextareaClientHeight] = useState(0); // Initial textarea client height

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const cursorPosRef = useRef<number | null>(null);
  const isUserTypingRef = useRef(false);

  const { onMessageSend, onUserTyping } = useSocketActions();

  const debouncedUserTyping = useDebounceCallback(
    (chatId: string, userId: string) => {
      isUserTypingRef.current = !isUserTypingRef.current;
      onUserTyping({ chatId, userId, isTyping: isUserTypingRef.current });
    },
    1000,
    {
      leading: true,
    }
  );

  useEffect(() => {
    if (textareaRef.current) {
      setTextareaClientHeight(textareaRef.current.clientHeight);
    }
  }, []);

  useEffect(() => {
    if (cursorPosRef.current !== null && textareaRef.current) {
      textareaRef.current.setSelectionRange(
        cursorPosRef.current,
        cursorPosRef.current
      );
      cursorPosRef.current = null; // Reset
    }
  }, [content]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    if (conversationType === "direct" && !receiverId) return;

    const message: Message = {
      id: nanoid(), // temporary id
      content,
      senderId: userId,
      status: "SENDING",
      messageType: "TEXT",
      isEdited: false,
      replyToId: null,
      editedAt: null,
      receiverId: null,
      createdAt: new Date(),
    };

    if (conversationType === "direct") {
      message.receiverId = receiverId;
    }

    onMessageSend({ chatId, message, conversationType });
    setContent("");
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const elem = e.target;

    setContent(elem.value);

    if (conversationType === "direct" && receiverId)
      debouncedUserTyping(chatId, receiverId);

    const currentRows = elem.scrollHeight / textareaClientHeight;

    elem.style.height = "auto";
    elem.style.height =
      currentRows <= MAX_ROWS
        ? `${elem.scrollHeight}px`
        : `${MAX_ROWS * textareaClientHeight}px`;
  };

  const handleEmojiClick = async (emojiObject: EmojiClickData) => {
    const emoji = emojiObject.emoji;

    if (textareaRef.current) {
      const textarea = textareaRef.current;

      const prevIndex = textarea.selectionStart;
      const nextIndex = textarea.selectionEnd;

      setContent(
        (prev) => prev.slice(0, prevIndex) + emoji + prev.slice(nextIndex)
      );

      cursorPosRef.current = prevIndex + emoji.length;
    }
  };

  const onOpenChange = async (open: boolean) => {
    if (!open && textareaRef.current) {
      const textarea = textareaRef.current;
      await new Promise((resolve) => setTimeout(resolve, 0));
      textarea.focus();
    }
  };

  return (
    <div className="w-full shadow border rounded-xl overflow-hidden ">
      <form onSubmit={handleSubmit} className="relative bg-sidebar flex gap-3">
        <div className="relative p-2 pb-3 w-full flex items-end gap-2">
          <div className="relative flex-1 flex gap-2 items-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-lg h-9 w-9 relative group"
            >
              <Paperclip size={18} />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-lg h-9 w-9 relative group"
            >
              <Image size={18} />
            </Button>

            <div className="has-[>textarea:focus]:ring-2 ring-ring min-h-12 w-full rounded-xl self-center flex border border-muted-foreground/50 items-center py-1">
              <textarea
                ref={textareaRef}
                name="message"
                autoFocus={true}
                className={`w-full px-4 bg-transparent resize-none min-h-6 text-foreground outline-none placeholder:text-muted-foreground transition-all duration-200`}
                placeholder="Type a message..."
                value={content}
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

            <Popover onOpenChange={onOpenChange}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="rounded-lg h-9 w-9"
                >
                  <Smile size={18} />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 md:w-96 w-72 min-h-[450px]">
                <Suspense
                  fallback={<Loader className="md:w-96 w-72 min-h-[450px]" />}
                >
                  <Picker onEmojiClick={handleEmojiClick} />
                </Suspense>
              </PopoverContent>
            </Popover>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-lg h-9 w-9 relative group"
            >
              <Mic size={18} />
            </Button>
          </div>
        </div>
        <div className="w-2/3 absolute h-1 bg-gradient-to-r self-end from-primary/60" />
      </form>
    </div>
  );
};

export default ChatInput;
