/**
 * useOpenAI.ts
 * -----------
 * React hook that provides OpenAI API functionality
 * for transcription and chat completions with audio.
 */

import { useState, useCallback } from "react";
import * as openaiService from "../../services/api/openai.service";
import {
  ChatMessage,
  AudioOptions,
  SimpleMessage,
} from "../../services/api/openai.service";

/**
 * Hook return type with OpenAI API state and functions
 */
export interface UseOpenAIReturn {
  /** Whether an API request is in progress */
  isLoading: boolean;
  /** Transcription result */
  transcription: string | null;
  /** Text response from GPT */
  response: string | null;
  /** Audio data from GPT */
  audioData: string | null;
  /** Error state if API request fails */
  error: Error | null;
  /** Transcribe audio using OpenAI API */
  transcribeAudio: (audioBlob: Blob) => Promise<string>;
  /** Send a text message to GPT and get text+audio response */
  sendMessage: (
    message: string,
    history?: SimpleMessage[],
  ) => Promise<openaiService.GPT4oResponse>;
  /** Send an audio recording to GPT */
  sendAudioMessage: (
    audioBlob: Blob,
    history?: SimpleMessage[],
  ) => Promise<openaiService.GPT4oAudioResponse>;
}

/**
 * Hook to use OpenAI API functionality
 * @param apiKey OpenAI API key
 * @param audioOptions Options for audio responses
 * @returns OpenAI API state and functions
 */
export const useOpenAI = (
  apiKey: string,
  audioOptions?: AudioOptions,
): UseOpenAIReturn => {
  // State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [audioData, setAudioData] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Transcribe audio using OpenAI API
   */
  const transcribeAudio = useCallback(
    async (audioBlob: Blob): Promise<string> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await openaiService.transcribeAudio(audioBlob, apiKey);
        setTranscription(result);
        return result;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      } finally {
        setIsLoading(false);
      }
    },
    [apiKey],
  );

  /**
   * Send a text message to GPT and get text+audio response
   */
  const sendMessage = useCallback(
    async (
      message: string,
      history: SimpleMessage[] = [],
    ): Promise<openaiService.GPT4oResponse> => {
      setIsLoading(true);
      setError(null);

      try {
        // Convert simple messages to ChatMessage format
        const formattedHistory =
          openaiService.formatConversationHistory(history);

        // Send to API
        const result = await openaiService.sendMessageToGPT4o(
          message,
          formattedHistory,
          apiKey,
          audioOptions,
        );

        // Update state with results
        setResponse(result.text);
        setAudioData(result.audioData);

        return result;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      } finally {
        setIsLoading(false);
      }
    },
    [apiKey, audioOptions],
  );

  /**
   * Send an audio recording to GPT
   */
  const sendAudioMessage = useCallback(
    async (
      audioBlob: Blob,
      history: SimpleMessage[] = [],
    ): Promise<openaiService.GPT4oAudioResponse> => {
      setIsLoading(true);
      setError(null);

      try {
        // Convert simple messages to ChatMessage format
        const formattedHistory =
          openaiService.formatConversationHistory(history);

        // Send to API
        const result = await openaiService.sendAudioToGPT4o(
          audioBlob,
          formattedHistory,
          apiKey,
          audioOptions,
        );

        // Update state with results
        setTranscription(result.transcription);
        setResponse(result.textResponse);
        setAudioData(result.audioData);

        return result;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        setError(errorObj);
        throw errorObj;
      } finally {
        setIsLoading(false);
      }
    },
    [apiKey, audioOptions],
  );

  return {
    isLoading,
    transcription,
    response,
    audioData,
    error,
    transcribeAudio,
    sendMessage,
    sendAudioMessage,
  };
};
