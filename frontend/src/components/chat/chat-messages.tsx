import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { format } from "date-fns";
import ChatMessagesSkeleton from "../skeleton-loading/chat-messages-skeleton";

const messages = [
  {
    id: 1,
    content: "Hey there! How's it going?",
    sender: "other",
    senderName: "Sarah Johnson",
    timestamp: new Date(2025, 4, 20, 14, 30),
    read: true,
  },
  {
    id: 2,
    content:
      "Hi Sarah! I'm good, just working on that project we discussed yesterday.",
    sender: "self",
    timestamp: new Date(2025, 4, 20, 14, 32),
    read: true,
  },
  {
    id: 3,
    content:
      "That's great! How's the progress so far? Did you manage to fix that issue with the layout?",
    sender: "other",
    senderName: "Sarah Johnson",
    timestamp: new Date(2025, 4, 20, 14, 35),
    read: true,
  },
  {
    id: 4,
    content:
      "Yes, I figured out what was causing the problem. It was a CSS specificity issue. I've fixed it now and the layout looks much better.",
    sender: "self",
    timestamp: new Date(2025, 4, 20, 14, 38),
    read: true,
  },
  {
    id: 5,
    content: "That's awesome! Can you share a screenshot of how it looks now?",
    sender: "other",
    senderName: "Sarah Johnson",
    timestamp: new Date(2025, 4, 20, 14, 40),
    read: true,
  },
  {
    id: 6,
    content:
      "Sure, I'll send it over in a minute. I'm just making a few more tweaks to make sure everything is perfect.",
    sender: "self",
    timestamp: new Date(2025, 4, 20, 14, 42),
    read: false,
  },
  {
    id: 7,
    content:
      "No rush! Take your time to make it look great. I'm working on some other tasks in the meantime.",
    sender: "other",
    senderName: "Sarah Johnson",
    timestamp: new Date(2025, 4, 21, 8, 10),
    read: false,
  },
  {
    id: 8,
    content:
      "By the way, do you think we'll be able to finish everything by the end of the week?",
    sender: "other",
    senderName: "Sarah Johnson",
    timestamp: new Date(2025, 4, 21, 8, 12),
    read: false,
  },
];

const ChatMessages = ({ chatId }: { chatId: string }) => {
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    scrollToBottom();
  }, []);

  // // Testing
  useEffect(() => {
    setTimeout(() => {
      setIsLoading(false);
    }, 3000);
  }, []);

  const groupedMessages: { [key: string]: typeof messages } = {};
  messages.forEach((message) => {
    const dateKey = format(message.timestamp, "yyyy-MM-dd");
    if (!groupedMessages[dateKey]) {
      groupedMessages[dateKey] = [];
    }
    groupedMessages[dateKey].push(message);
  });

  return (
    <div className="h-full w-full overflow-y-auto p-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {isLoading ? (
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

              {messagesGroup.map((message, i) => {
                const isConsecutive =
                  i > 0 && messagesGroup[i - 1].sender === message.sender;

                return (
                  <div
                    key={message.id}
                    className={`flex mb-5 ${
                      message.sender === "self"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    {message.sender !== "self" && !isConsecutive && (
                      <Avatar className="h-8 w-8 mr-2 mt-1 border border-border">
                        <div className="bg-secondary h-full w-full flex items-center justify-center text-base font-medium text-secondary-foreground">
                          {message.senderName?.charAt(0)}
                        </div>
                      </Avatar>
                    )}
                    {message.sender !== "self" && isConsecutive && (
                      <div className="w-8 mr-2" />
                    )}
                    <div
                      className={`max-w-[75%] flex flex-col ${
                        message.sender === "self" ? "items-end" : "items-start"
                      }`}
                    >
                      {message.sender !== "self" && !isConsecutive && (
                        <div className="text-xs text-foreground/80 mb-1 ml-1">
                          {message.senderName}
                        </div>
                      )}
                      <div
                        className={`relative rounded-2xl px-4 py-2 ring-1 backdrop-blur-sm ${
                          message.sender === "self"
                            ? "bg-primary text-black ring-ring/20"
                            : "bg-secondary text-secondary-foreground ring-ring/15"
                        }`}
                      >
                        <p className="text-sm font-medium leading-relaxed">
                          {message.content}
                        </p>
                        <div
                          className={`flex items-center text-xs mt-1.5 ${
                            message.sender === "self"
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          <span>{format(message.timestamp, "h:mm a")}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          <div ref={messagesEndRef} />
        </>
      )}
    </div>
  );
};

export default ChatMessages;
