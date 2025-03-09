/**
 * useVoiceState.ts
 * --------------
 * React hook that manages the overall voice UI state.
 */

import { useState, useCallback } from "react";

/**
 * Voice UI states
 */
export type VoiceState =
  | "idle"
  | "recording"
  | "processing"
  | "speaking"
  | "error";

/**
 * Hook return type with voice state and functions
 */
export interface UseVoiceStateReturn {
  /** Current state of the voice UI */
  state: VoiceState;
  /** Set the voice UI state */
  setState: (state: VoiceState) => void;
  /** Error message if state is "error" */
  error: string | null;
  /** Set an error message and change state to "error" */
  setError: (message: string) => void;
  /** Clear error and return to idle state */
  clearError: () => void;
  /** Whether the UI is currently in an active state */
  isActive: boolean;
  /** Whether recording is possible */
  canRecord: boolean;
  /** Whether processing is happening */
  isProcessing: boolean;
}

/**
 * Hook to manage voice UI state
 * @param initialState Optional initial voice state
 * @returns Voice state and control functions
 */
export const useVoiceState = (
  initialState: VoiceState = "idle",
): UseVoiceStateReturn => {
  // State
  const [state, setStateInternal] = useState<VoiceState>(initialState);
  const [error, setErrorMessage] = useState<string | null>(null);

  /**
   * Set the voice UI state
   */
  const setState = useCallback((newState: VoiceState) => {
    setStateInternal(newState);

    // Clear error when changing to a non-error state
    if (newState !== "error") {
      setErrorMessage(null);
    }
  }, []);

  /**
   * Set an error message and change state to "error"
   */
  const setError = useCallback((message: string) => {
    setErrorMessage(message);
    setStateInternal("error");
  }, []);

  /**
   * Clear error and return to idle state
   */
  const clearError = useCallback(() => {
    setErrorMessage(null);
    setStateInternal("idle");
  }, []);

  /**
   * Whether the UI is currently in an active state
   */
  const isActive = state !== "idle" && state !== "error";

  /**
   * Whether recording is possible in the current state
   */
  const canRecord = state === "idle" || state === "error";

  /**
   * Whether processing is happening
   */
  const isProcessing = state === "processing";

  return {
    state,
    setState,
    error,
    setError,
    clearError,
    isActive,
    canRecord,
    isProcessing,
  };
};
