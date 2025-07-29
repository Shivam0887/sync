import type { Conversation, Message } from "@/types/chat.types";

import { useEffect, useRef } from "react";
import { Avatar } from "@/components/ui/avatar";
import { format } from "date-fns";
import ChatMessagesSkeleton from "../skeleton-loading/chat-messages-skeleton";
import { useChat } from "@/providers/chat-provider";

interface ChatMessageProps {
  message: Message;
  userId: string;
  conversation: Conversation;
  isConsecutive: boolean;
}

const ChatMessage = ({
  message,
  userId,
  conversation,
  isConsecutive,
}: ChatMessageProps) => {
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

  return (
    <div className={`flex mb-5 ${isSelf ? "justify-end" : "justify-start"}`}>
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
            <span>{format(message.timestamp, "h:mm a")}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const ChatMessages = ({ chatId, userId }: { chatId: string, userId: string }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { chat: messages, isChatMessagesLoading, conversation } = useChat();

  useEffect(() => {
    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    scrollToBottom();
  }, []);

  const groupedMessages: { [key: string]: Message[] } = {};

  (messages[chatId as string] || []).forEach((message) => {
    const dateKey = format(message.timestamp, "yyyy-MM-dd");
    if (!groupedMessages[dateKey]) {
      groupedMessages[dateKey] = [];
    }
    groupedMessages[dateKey].push(message);
  });

  if (!conversation[chatId])
    return (
      <div className="text-center text-destructive py-8">
        Conversation not found or you don’t have access.
      </div>
    );

  return (
    <div className="h-full w-full overflow-y-auto p-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {isChatMessagesLoading ? (
        <ChatMessagesSkeleton />
      ) : (
        <>
          {Object.entries(groupedMessages).map(([date, messagesGroup]) => (
            <div key={date} className="mb-6">
              <div className="flex justify-center mb-6">
                <span className="px-4 py-1.5 text-xs bg-accent backdrop-blur-md rounded-full text-accent-foreground border">
                  {format(new Date(date), "EEEE, MMMM d, yyyy")}
                </span>
              </div>

              {messagesGroup.map((message, i) => (
                <ChatMessage
                  key={message.id}
                  conversation={conversation[chatId]}
                  message={message}
                  userId={userId}
                  isConsecutive={
                    i > 0 && messagesGroup[i - 1].senderId === message.senderId
                  }
                />
              ))}
            </div>
          ))}

          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  );
};

export default ChatMessages;
