/**
 * useSilenceDetector.ts
 * -------------------
 * React hook that provides silence detection functionality
 * using the underlying silence detector service.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import * as silenceDetectorService from "../../services/audio/silence-detector.service";
import { SilenceDetectorOptions } from "../../services/audio/silence-detector.service";

/**
 * Hook return type with silence detection state and controls
 */
export interface UseSilenceDetectorReturn {
  /** Whether the detector is currently running */
  isRunning: boolean;
  /** Whether silence is currently detected */
  isSilent: boolean;
  /** Whether silence has been detected for the threshold duration */
  silenceDetected: boolean;
  /** Start monitoring for silence */
  startDetection: () => Promise<void>;
  /** Stop monitoring for silence */
  stopDetection: () => void;
  /** Error state if detection fails */
  error: Error | null;
}

/**
 * Hook to use silence detection functionality
 * @param options Silence detector configuration options
 * @param onSilenceDetected Callback when silence is detected for the threshold duration
 * @returns Silence detection state and control functions
 */
export const useSilenceDetector = (
  options: SilenceDetectorOptions = {},
  onSilenceDetected?: () => void,
): UseSilenceDetectorReturn => {
  // State
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isSilent, setIsSilent] = useState<boolean>(false);
  const [silenceDetected, setSilenceDetected] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs
  const detector = useRef<silenceDetectorService.SilenceDetector | null>(null);

  /**
   * Initialize the silence detector
   */
  const initialize = useCallback(async () => {
    try {
      const newDetector = silenceDetectorService.createSilenceDetector(
        options,
        {
          onSilenceDetected: () => {
            setSilenceDetected(true);
            onSilenceDetected?.();
          },
          onSpeechDetected: () => {
            setIsSilent(false);
          },
          onError: (err) => {
            setError(err);
            setIsRunning(false);
          },
        },
      );

      await newDetector.initialize();
      detector.current = newDetector;
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [options, onSilenceDetected]);

  /**
   * Start monitoring for silence
   */
  const startDetection = useCallback(async () => {
    try {
      setError(null);
      setSilenceDetected(false);

      if (!detector.current) {
        await initialize();
      }

      if (detector.current) {
        detector.current.start();
        setIsRunning(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [initialize]);

  /**
   * Stop monitoring for silence
   */
  const stopDetection = useCallback(() => {
    if (detector.current) {
      detector.current.stop();
      setIsRunning(false);
    }
  }, []);

  // Update isSilent state periodically when running
  useEffect(() => {
    if (isRunning && detector.current) {
      const interval = setInterval(() => {
        setIsSilent(detector.current?.isSilent() || false);
      }, 100);

      return () => clearInterval(interval);
    }
  }, [isRunning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (detector.current) {
        detector.current.cleanup();
      }
    };
  }, []);

  return {
    isRunning,
    isSilent,
    silenceDetected,
    startDetection,
    stopDetection,
    error,
  };
};
