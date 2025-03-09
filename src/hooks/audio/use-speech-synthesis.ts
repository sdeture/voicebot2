/**
 * useSpeechSynthesis.ts
 * -------------------
 * React hook that provides text-to-speech functionality
 * using the underlying speech synthesis service.
 */

import { useState, useCallback, useRef } from "react";
import * as speechService from "../../services/audio/speech-synthesis.service";
import { SpeechOptions } from "../../services/audio/speech-synthesis.service";

/**
 * Hook return type with speech synthesis state and controls
 */
export interface UseSpeechSynthesisReturn {
  /** Whether speech is currently playing */
  isSpeaking: boolean;
  /** Whether speech is currently paused */
  isPaused: boolean;
  /** Speak the provided text */
  speak: (text: string, options?: SpeechOptions) => void;
  /** Pause the current speech */
  pause: () => void;
  /** Resume the current speech */
  resume: () => void;
  /** Stop the current speech */
  stop: () => void;
  /** Whether speech synthesis is supported */
  isSupported: boolean;
  /** Error state if speech fails */
  error: Error | null;
}

/**
 * Hook to use speech synthesis functionality
 * @returns Speech synthesis state and control functions
 */
export const useSpeechSynthesis = (): UseSpeechSynthesisReturn => {
  // State
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Check for browser support
  const isSupported = speechService.isSpeechSynthesisSupported();

  // Refs
  const speechController =
    useRef<speechService.SpeechSynthesisController | null>(null);

  /**
   * Speak the provided text
   */
  const speak = useCallback(
    (text: string, options?: SpeechOptions) => {
      if (!isSupported) {
        setError(
          new Error("Speech synthesis is not supported in this browser"),
        );
        return;
      }

      try {
        // Stop any current speech
        if (speechController.current) {
          speechController.current.stop();
        }

        setError(null);

        // Create new speech
        speechController.current = speechService.speak(text, options, {
          onStart: () => {
            setIsSpeaking(true);
            setIsPaused(false);
          },
          onPause: () => {
            setIsPaused(true);
          },
          onResume: () => {
            setIsPaused(false);
          },
          onEnd: () => {
            setIsSpeaking(false);
            setIsPaused(false);
          },
          onError: (err) => {
            setError(err);
            setIsSpeaking(false);
            setIsPaused(false);
          },
        });

        // Start speaking
        speechController.current.start();
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [isSupported],
  );

  /**
   * Pause the current speech
   */
  const pause = useCallback(() => {
    if (speechController.current) {
      speechController.current.pause();
      setIsPaused(true);
    }
  }, []);

  /**
   * Resume the current speech
   */
  const resume = useCallback(() => {
    if (speechController.current) {
      speechController.current.resume();
      setIsPaused(false);
    }
  }, []);

  /**
   * Stop the current speech
   */
  const stop = useCallback(() => {
    if (speechController.current) {
      speechController.current.stop();
      setIsSpeaking(false);
      setIsPaused(false);
    }
  }, []);

  return {
    isSpeaking,
    isPaused,
    speak,
    pause,
    resume,
    stop,
    isSupported,
    error,
  };
};
