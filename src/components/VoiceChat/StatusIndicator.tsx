import React from "react";
import { cn } from "@/utils/cn";
import { Mic, MicOff, Loader2, Volume2, AlertTriangle } from "lucide-react";

export type StatusType =
  | "idle"
  | "recording"
  | "processing"
  | "speaking"
  | "error";

interface StatusIndicatorProps {
  status?: StatusType;
  className?: string;
}

const StatusIndicator = ({
  status = "idle",
  className,
}: StatusIndicatorProps) => {
  const getStatusColor = () => {
    switch (status) {
      case "idle":
        return "bg-gray-200";
      case "recording":
        return "bg-red-500";
      case "processing":
        return "bg-yellow-500";
      case "speaking":
        return "bg-blue-500";
      case "error":
        return "bg-destructive";
      default:
        return "bg-gray-200";
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case "idle":
        return <MicOff className="h-4 w-4 text-gray-500" />;
      case "recording":
        return <Mic className="h-4 w-4 text-white" />;
      case "processing":
        return <Loader2 className="h-4 w-4 text-white animate-spin" />;
      case "speaking":
        return <Volume2 className="h-4 w-4 text-white" />;
      case "error":
        return <AlertTriangle className="h-4 w-4 text-white" />;
      default:
        return <MicOff className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case "idle":
        return "Ready";
      case "recording":
        return "Recording...";
      case "processing":
        return "Processing...";
      case "speaking":
        return "Speaking...";
      case "error":
        return "Error";
      default:
        return "Ready";
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-full bg-white",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center w-6 h-6 rounded-full",
          getStatusColor(),
          status === "recording" && "animate-pulse",
          status === "error" && "animate-pulse",
        )}
      >
        {getStatusIcon()}
      </div>
      <span className="text-sm font-medium">{getStatusText()}</span>
    </div>
  );
};

export default StatusIndicator;
