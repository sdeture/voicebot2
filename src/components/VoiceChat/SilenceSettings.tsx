import React from "react";
import { Slider } from "../ui/slider";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { Settings } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

interface SilenceSettingsProps {
  silenceDuration: number;
  onSilenceDurationChange: (value: number) => void;
  className?: string;
}

const SilenceSettings: React.FC<SilenceSettingsProps> = ({
  silenceDuration,
  onSilenceDurationChange,
  className = "",
}) => {
  // Convert seconds to a more readable format
  const formatDuration = (seconds: number): string => {
    if (seconds === 0) return "Immediate";
    return seconds === 1 ? "1 second" : `${seconds} seconds`;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={`h-8 w-8 rounded-full ${className}`}
          title="Silence detection settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <h4 className="font-medium leading-none">
            Silence Detection Settings
          </h4>
          <p className="text-sm text-muted-foreground">
            Adjust how long the system waits after detecting silence before
            automatically submitting your message.
          </p>
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="silence-duration">Wait time</Label>
              <span className="text-sm text-muted-foreground">
                {formatDuration(silenceDuration / 1000)}
              </span>
            </div>
            <Slider
              id="silence-duration"
              min={0}
              max={30000}
              step={1000}
              value={[silenceDuration]}
              onValueChange={(value) => onSilenceDurationChange(value[0])}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Immediate</span>
              <span>30 seconds</span>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default SilenceSettings;
