import React, { useState } from "react";
import { Mic, MicOff, Send, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

export type VoiceState =
  | "idle"
  | "recording"
  | "processing"
  | "speaking"
  | "error";

interface VoiceControlsProps {
  onStartListening?: () => void;
  onStopListening?: () => void;
  onSendMessage?: (message: string) => void;
  voiceState?: VoiceState;
  disabled?: boolean;
}

const VoiceControls: React.FC<VoiceControlsProps> = ({
  onStartListening = () => {},
  onStopListening = () => {},
  onSendMessage = () => {},
  voiceState = "idle",
  disabled = false,
}) => {
  const [textInput, setTextInput] = useState("");

  const handleMicrophoneClick = () => {
    if (voiceState === "recording") {
      onStopListening();
    } else {
      onStartListening();
    }
  };

  const handleSendMessage = () => {
    if (textInput.trim()) {
      onSendMessage(textInput);
      setTextInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="w-full p-4 border-t border-gray-200 bg-white rounded-b-lg shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Type your message here..."
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={
              disabled ||
              voiceState === "recording" ||
              voiceState === "processing"
            }
          />
        </div>

        <Button
          onClick={handleSendMessage}
          disabled={
            disabled ||
            !textInput.trim() ||
            voiceState === "recording" ||
            voiceState === "processing"
          }
          className="h-10 w-10 p-0"
          variant="default"
        >
          <Send size={18} />
        </Button>

        <Button
          onClick={handleMicrophoneClick}
          disabled={disabled || voiceState === "processing"}
          className={cn(
            "h-14 w-14 rounded-full p-0",
            voiceState === "recording" && "bg-red-500 hover:bg-red-600",
            voiceState === "processing" && "bg-yellow-500",
            voiceState === "speaking" && "bg-blue-500",
            voiceState === "error" && "bg-destructive hover:bg-destructive/90",
          )}
          variant={voiceState === "idle" ? "default" : "ghost"}
        >
          {voiceState === "processing" ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : voiceState === "recording" ? (
            <MicOff className="h-6 w-6" />
          ) : voiceState === "error" ? (
            <AlertTriangle className="h-6 w-6" />
          ) : (
            <Mic className="h-6 w-6" />
          )}
        </Button>
      </div>

      <div className="mt-2 text-xs text-gray-500 text-center">
        {voiceState === "idle" && "Click the microphone to start recording"}
        {voiceState === "recording" && "Recording... Click again to stop"}
        {voiceState === "processing" && "Processing your request..."}
        {voiceState === "speaking" && "AI is speaking..."}
        {voiceState === "error" && "An error occurred. Please try again."}
      </div>
    </div>
  );
};

export default VoiceControls;
