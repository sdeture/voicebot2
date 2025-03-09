/**
 * useAudioRecorder.ts
 * ------------------
 * React hook that provides audio recording functionality
 * using the underlying recorder service.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import * as recorderService from "../../services/audio/recorder.service";
import { RecordingOptions } from "../../services/audio/recorder.service";

/**
 * Hook return type with recording state and controls
 */
export interface UseAudioRecorderReturn {
  /** Whether recording is currently active */
  isRecording: boolean;
  /** Whether recorder has been initialized */
  isInitialized: boolean;
  /** Error state if recording fails */
  error: Error | null;
  /** Start recording audio */
  startRecording: (timeslice?: number) => Promise<void>;
  /** Stop recording audio */
  stopRecording: () => void;
  /** Latest recorded audio blob */
  audioBlob: Blob | null;
}

/**
 * Hook to use audio recording functionality
 * @param options Recording configuration options
 * @returns Recording state and control functions
 */
export const useAudioRecorder = (
  options: RecordingOptions = {},
): UseAudioRecorderReturn => {
  // State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  // Refs
  const recorder = useRef<recorderService.AudioRecorder | null>(null);

  /**
   * Initialize the recorder
   */
  const initialize = useCallback(async () => {
    try {
      if (!recorderService.isAudioRecordingSupported()) {
        throw new Error("Audio recording is not supported in this browser");
      }

      const newRecorder = recorderService.createAudioRecorder(options, {
        onStart: () => {
          setIsRecording(true);
          setError(null);
        },
        onStop: (blob) => {
          setIsRecording(false);
          setAudioBlob(blob);
        },
        onError: (err) => {
          setIsRecording(false);
          setError(err);
        },
      });

      await newRecorder.initialize();
      recorder.current = newRecorder;
      setIsInitialized(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsInitialized(false);
    }
  }, [options]);

  /**
   * Start recording audio
   */
  const startRecording = useCallback(
    async (timeslice?: number) => {
      try {
        setError(null);

        if (!recorder.current) {
          await initialize();
        }

        if (recorder.current) {
          await recorder.current.start(timeslice);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [initialize],
  );

  /**
   * Stop recording audio
   */
  const stopRecording = useCallback(() => {
    if (recorder.current) {
      recorder.current.stop();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recorder.current) {
        recorder.current.cleanup();
      }
    };
  }, []);

  return {
    isRecording,
    isInitialized,
    error,
    startRecording,
    stopRecording,
    audioBlob,
  };
};
