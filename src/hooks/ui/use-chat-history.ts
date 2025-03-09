/**
 * useChatHistory.ts
 * ---------------
 * React hook that manages the chat message history.
 */

import { useState, useCallback } from "react";

/**
 * Message status types
 */
export type MessageStatus = "sending" | "sent" | "error";

/**
 * Chat message interface
 */
export interface ChatMessage {
  /** Unique identifier for the message */
  id: string;
  /** Content of the message */
  content: string;
  /** Sender of the message */
  sender: "user" | "ai";
  /** Timestamp when the message was created */
  timestamp: Date;
  /** Current status of the message */
  status?: MessageStatus;
  /** Error message if status is "error" */
  errorMessage?: string;
}

/**
 * New message data without ID and timestamp
 */
export interface NewMessage {
  content: string;
  sender: "user" | "ai";
  status?: MessageStatus;
  errorMessage?: string;
}

/**
 * Message update data
 */
export interface MessageUpdate {
  content?: string;
  status?: MessageStatus;
  errorMessage?: string;
}

/**
 * Hook return type with chat history state and functions
 */
export interface UseChatHistoryReturn {
  /** Array of all messages in the chat */
  messages: ChatMessage[];
  /** Add a new message to the chat */
  addMessage: (message: NewMessage) => string;
  /** Update an existing message */
  updateMessage: (id: string, update: MessageUpdate) => boolean;
  /** Remove a message from the chat */
  removeMessage: (id: string) => boolean;
  /** Clear all messages from the chat */
  clearMessages: () => void;
}

/**
 * Hook to manage chat history
 * @param initialMessages Optional initial messages
 * @returns Chat history state and functions
 */
export const useChatHistory = (
  initialMessages: ChatMessage[] = [],
): UseChatHistoryReturn => {
  // State
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);

  /**
   * Generate a unique ID for a new message
   */
  const generateMessageId = useCallback((): string => {
    return Date.now().toString() + Math.random().toString(36).substring(2, 9);
  }, []);

  /**
   * Add a new message to the chat
   */
  const addMessage = useCallback(
    (message: NewMessage): string => {
      const id = generateMessageId();

      const newMessage: ChatMessage = {
        id,
        content: message.content,
        sender: message.sender,
        timestamp: new Date(),
        status: message.status || "sent",
        errorMessage: message.errorMessage,
      };

      setMessages((prev) => [...prev, newMessage]);

      return id;
    },
    [generateMessageId],
  );

  /**
   * Update an existing message
   */
  const updateMessage = useCallback(
    (id: string, update: MessageUpdate): boolean => {
      let found = false;

      setMessages((prev) => {
        const updated = prev.map((msg) => {
          if (msg.id === id) {
            found = true;
            return { ...msg, ...update };
          }
          return msg;
        });

        return found ? updated : prev;
      });

      return found;
    },
    [],
  );

  /**
   * Remove a message from the chat
   */
  const removeMessage = useCallback((id: string): boolean => {
    let found = false;

    setMessages((prev) => {
      const filtered = prev.filter((msg) => {
        if (msg.id === id) {
          found = true;
          return false;
        }
        return true;
      });

      return found ? filtered : prev;
    });

    return found;
  }, []);

  /**
   * Clear all messages from the chat
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    addMessage,
    updateMessage,
    removeMessage,
    clearMessages,
  };
};
