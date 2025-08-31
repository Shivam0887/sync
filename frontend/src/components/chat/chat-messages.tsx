import type { Conversation, Message, MessageStatus } from "@/types/chat.types";

import { useCallback, useEffect, useRef } from "react";
import { Avatar } from "@/components/ui/avatar";
import { format, getTime } from "date-fns";
import ChatMessagesSkeleton from "../skeleton-loading/chat-messages-skeleton";
import {
  useChatActions,
  useConversations,
  useFetchChatMessages,
  useTypingStatus,
} from "@/stores/chat-store";
import { Check, CheckCheck, CircleAlert, Clock, Ellipsis } from "lucide-react";
import { cn, toastErrorHandler } from "@/lib/utils";
import { useSocketActions } from "@/providers/socket-provider";

interface ChatMessageProps {
  message: Message;
  userId: string;
  conversation: Conversation;
  isConsecutive: boolean;
  playSendMessageSound: () => void;
  containerClassName?: string;
}

const ChatMessage = ({
  message,
  userId,
  conversation,
  isConsecutive,
  playSendMessageSound,
  containerClassName,
}: ChatMessageProps) => {
  const prevMessageStatusRef = useRef(message.status);

  useEffect(() => {
    if (prevMessageStatusRef.current === "SENDING" && message.status === "SENT")
      playSendMessageSound();
  }, [message.status, playSendMessageSound]);

  // For direct messages, get the other participant's info
  let otherUser: { id: string; username: string } | undefined;

  if (conversation.type === "direct") {
    otherUser =
      conversation.participants[0].id === userId
        ? conversation.participants[1]
        : conversation.participants[0];
  }

  // Both direct and group messages have senderId
  const senderId = message.senderId;
  const isSelf = senderId === userId;

  // Determine sender name based on conversation type
  let senderName: string | undefined = undefined;

  if (conversation.type === "direct" && !isSelf && otherUser) {
    // For direct messages, show the other user's username
    senderName = otherUser.username;
  } else if (conversation.type === "group" && !isSelf) {
    // For group messages, find the sender in participants
    const sender = conversation.participants.find((p) => p.id === senderId);
    senderName = sender?.username;
  }

  const StatusToIcon: Record<MessageStatus, React.ReactNode> = {
    SENDING: <Clock className="stroke-[2.5] size-4" />,
    SENT: <Check className="stroke-[2.5] size-4" />,
    DELIVERED: <CheckCheck className="stroke-[2.5] size-4" />,
    READ: <CheckCheck className="stroke-[2.5] size-4 text-[#53bdeb]" />,
    FAILED: <CircleAlert className="stroke-[2.5] size-4 text-red-600" />,
  };

  return (
    <div
      id={`${senderId}:${message.id}`}
      className={cn(
        `flex mb-5 ${isSelf ? "justify-end" : "justify-start"}`,
        containerClassName
      )}
      data-message-type={conversation.type}
      data-status={message.status}
      data-user={senderId}
    >
      {!isSelf && !isConsecutive && (
        <Avatar className="h-8 w-8 mr-2 mt-1 border border-border">
          <div className="bg-secondary h-full w-full flex items-center justify-center text-base font-medium text-secondary-foreground">
            {senderName ? senderName.charAt(0) : "A"}
          </div>
        </Avatar>
      )}

      {!isSelf && isConsecutive && <div className="w-8 mr-2" />}

      <div
        className={`max-w-[75%] flex flex-col ${
          isSelf ? "items-end" : "items-start"
        }`}
      >
        {!isSelf && !isConsecutive && (
          <div className="text-xs text-foreground/80 mb-1 ml-1">
            {senderName || senderId}
          </div>
        )}
        <div
          className={`relative shadow rounded-2xl px-4 py-2 ring-1 backdrop-blur-sm ${
            isSelf
              ? "bg-primary text-primary-foreground ring-ring/20"
              : "bg-secondary text-secondary-foreground ring-ring/15"
          }`}
        >
          <p className="text-sm leading-relaxed">{message.content}</p>
          <div
            className={`flex items-center text-xs mt-1.5 ${
              isSelf ? "justify-end" : "justify-start"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              {format(message.createdAt, "h:mm a")}

              {isSelf && (
                <span
                  className={`transition-transform ${
                    message.status === "READ" ? "rotate-y-[360deg]" : "rotate-y-0"
                  }`}
                >
                  {StatusToIcon[message.status]}
                </span>
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const ChatMessages: React.FC<{
  chatId: string;
  userId: string;
}> = ({ chatId, userId }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const {
    data: messages,
    isLoading: isChatMessagesLoading,
    error,
  } = useFetchChatMessages(chatId);

  const conversation = useConversations();
  const { onMessageRead } = useSocketActions();
  const { updateMessageStatus } = useChatActions();
  const isTyping = useTypingStatus(chatId, userId);

  useEffect(() => {
    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    };

    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const [senderId, messageId] = entry.target.id.split(":");
          const conversationType = (entry.target.getAttribute("data-message-type") ?? "direct") as "direct" | "group";
          
          onMessageRead({ chatId, senderId, messageId, conversationType });
          updateMessageStatus({
            chatId,
            messageId,
            status: "READ",
          });
          observer.unobserve(entry.target);
        }
      });
    });

    const unreadMessages = Array.from(
      document.querySelectorAll("[data-status=DELIVERED]")
    ).filter((elem) => elem.getAttribute("data-user") !== userId);

    unreadMessages.forEach((elem) => observer.observe(elem));

    return () => {
      unreadMessages.forEach((elem) => observer.unobserve(elem));
    };
  }, [userId, chatId, messages, onMessageRead, updateMessageStatus]);

  const playSendMessageSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.1;
      audioRef.current.play();
    }
  }, []);

  const groupedMessages: { [key: string]: Message[] } = {};

  (messages ?? []).forEach((message) => {
    const dateKey = format(message.createdAt, "yyyy-MM-dd");
    if (!groupedMessages[dateKey]) {
      groupedMessages[dateKey] = [];
    }
    groupedMessages[dateKey].push(message);
  });

  if (error) {
    toastErrorHandler({ error });
    return null;
  }

  if (!conversation)
    return (
      <div className="text-center text-destructive py-8">
        Conversation not found or you don&apos;t have access.
      </div>
    );

  return (
    <div className="h-full w-full bg-sidebar text-sidebar-foreground overflow-y-auto p-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <audio
        ref={audioRef}
        src="/audio/sending-message-sound-effect.mp3"
        hidden
      />
      {isChatMessagesLoading ? (
        <ChatMessagesSkeleton />
      ) : (
        <>
          {Object.entries(groupedMessages).map(([date, messagesGroup]) => (
            <div key={date} className="mb-6 relative">
              <div className="sticky top-0 flex justify-center mb-6">
                <span className="px-4 py-1.5 text-xs bg-accent backdrop-blur-md rounded-full text-accent-foreground border">
                  {format(new Date(date), "EEEE, MMMM d, yyyy")}
                </span>
              </div>
              {messagesGroup.map((message, i) => (
                <ChatMessage
                  key={getTime(message.createdAt)}
                  playSendMessageSound={playSendMessageSound}
                  conversation={conversation[chatId]}
                  message={message}
                  userId={userId}
                  isConsecutive={
                    i > 0 && messagesGroup[i - 1].senderId === message.senderId
                  }
                />
              ))}

              {isTyping && (
                <div className="max-w-fit px-4 py-2 rounded-lg bg-secondary text-secondary-foreground ring-ring/15">
                  <Ellipsis className="size-6 animate-pulse" />
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  );
};

export default ChatMessages;
