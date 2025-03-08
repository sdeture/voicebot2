import React from "react";
import { ScrollArea } from "../ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { MessageCircle } from "lucide-react";

type Message = {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
  status?: "sending" | "sent" | "error";
};

type ChatHistoryProps = {
  messages?: Message[];
  className?: string;
};

const ChatHistory = ({
  messages = [
    {
      id: "1",
      content: "Hello! How can I help you today?",
      sender: "ai",
      timestamp: new Date(Date.now() - 60000 * 5),
      status: "sent",
    },
    {
      id: "2",
      content: "I'd like to know more about voice recognition technology.",
      sender: "user",
      timestamp: new Date(Date.now() - 60000 * 4),
      status: "sent",
    },
    {
      id: "3",
      content:
        "Voice recognition technology uses AI to convert spoken language into text. It analyzes audio patterns and matches them to known words and phrases. Modern systems use deep learning to improve accuracy over time. Would you like to know about specific applications or how it works in more detail?",
      sender: "ai",
      timestamp: new Date(Date.now() - 60000 * 3),
      status: "sent",
    },
  ],
  className = "",
}: ChatHistoryProps) => {
  // Format timestamp to readable time
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div
      className={`w-full h-full bg-background rounded-lg border border-border shadow-sm ${className}`}
    >
      <ScrollArea className="h-full p-4">
        <div className="flex flex-col space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <MessageCircle className="w-12 h-12 mb-2 opacity-50" />
              <p>No messages yet. Start a conversation!</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`flex max-w-[80%] ${message.sender === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div className="flex-shrink-0 mt-1">
                    {message.sender === "ai" ? (
                      <Avatar>
                        <AvatarImage
                          src="https://api.dicebear.com/7.x/bottts/svg?seed=ai-assistant"
                          alt="AI Assistant"
                        />
                        <AvatarFallback>AI</AvatarFallback>
                      </Avatar>
                    ) : (
                      <Avatar>
                        <AvatarImage
                          src="https://api.dicebear.com/7.x/avataaars/svg?seed=user"
                          alt="User"
                        />
                        <AvatarFallback>You</AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                  <div
                    className={`mx-2 px-4 py-3 rounded-lg ${
                      message.sender === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    <div className="whitespace-pre-wrap break-words">
                      {message.content}
                    </div>
                    <div
                      className={`text-xs mt-1 ${
                        message.sender === "user"
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatTime(message.timestamp)}
                      {message.status && message.sender === "user" && (
                        <span className="ml-2">
                          {message.status === "sending" && "• Sending..."}
                          {message.status === "sent" && "• Sent"}
                          {message.status === "error" && "• Failed to send"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ChatHistory;
