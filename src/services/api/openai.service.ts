/**
 * OpenAI Service
 * -------------
 * Handles communication with the OpenAI API for transcription
 * and chat completions with audio responses.
 */

// Types
/**
 * Represents a single chat message in the conversation
 */
export interface ChatMessage {
  /** Role of the message sender */
  role: "user" | "assistant" | "system";
  /** Text content of the message */
  content: string;
  /** Optional audio data for responses */
  audio?: {
    id?: string;
    expires_at?: number;
    data?: string; // Base64-encoded audio data
    transcript?: string;
  };
}

/**
 * Parameters for a chat completion request
 */
export interface ChatCompletionRequest {
  /** The model to use */
  model: string;
  /** The conversation history */
  messages: ChatMessage[];
  /** Temperature for response generation (0-2) */
  temperature?: number;
  /** Maximum tokens to generate */
  max_tokens?: number;
  /** Output modalities (text, audio) */
  modalities?: string[];
  /** Audio generation options */
  audio?: {
    /** Voice to use (e.g., "alloy") */
    voice?: string;
    /** Output audio format (e.g., "wav") */
    format?: string;
  };
}

/**
 * Structure for the chat completion response
 */
export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Structure for audio transcription responses
 */
export interface AudioTranscriptionResponse {
  text: string;
}

/**
 * Response from sendMessageToGPT4o
 */
export interface GPT4oResponse {
  /** Text response from GPT-4o */
  text: string;
  /** Base64-encoded audio data */
  audioData: string | null;
}

/**
 * Response from sendAudioToGPT4o
 */
export interface GPT4oAudioResponse {
  /** Transcription of the input audio */
  transcription: string;
  /** Text response from GPT-4o */
  textResponse: string;
  /** Base64-encoded audio data */
  audioData: string | null;
}

/**
 * Options for audio responses
 */
export interface AudioOptions {
  /** Voice to use (e.g., "alloy") */
  voice?: string;
  /** Output audio format (e.g., "wav") */
  format?: string;
}

/**
 * Audio message in a simplified format for the API
 */
export interface SimpleMessage {
  /** Content of the message */
  content: string;
  /** Sender of the message */
  sender: "user" | "ai";
}

// Configuration
const API_CONFIG = {
  apiUrl: "https://api.openai.com/v1",
  chatCompletionEndpoint: "/chat/completions",
  audioTranscriptionEndpoint: "/audio/transcriptions",
  audioModel: "whisper-1",
  gptModel: "gpt-4o-audio-preview",
  systemPrompt:
    "You are a helpful voice assistant. Provide concise and informative responses.",
  temperature: 0.7,
  max_tokens: 150,
};

// Step 1: Authentication and request preparation
/**
 * Validate the OpenAI API key
 * @param apiKey The API key to validate
 * @throws Error if the API key is missing
 */
const validateApiKey = (apiKey: string): void => {
  if (!apiKey) {
    throw new Error("OpenAI API key is required");
  }
};

/**
 * Create headers for OpenAI API requests
 * @param apiKey The OpenAI API key
 * @returns Headers for API requests
 */
const createApiHeaders = (apiKey: string): HeadersInit => {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
};

// Step 2: Audio transcription
/**
 * Process the audio blob for transcription
 * @param audioBlob The audio blob to process
 * @returns A processed audio blob
 */
const prepareAudioForTranscription = (audioBlob: Blob): Blob => {
  if (audioBlob.type !== "audio/mp3" && audioBlob.type !== "audio/mpeg") {
    return new Blob([audioBlob], { type: "audio/webm" });
  }
  return audioBlob;
};

/**
 * Create form data for audio transcription
 * @param audioBlob The processed audio blob
 * @returns FormData for the transcription request
 */
const createTranscriptionFormData = (audioBlob: Blob): FormData => {
  const formData = new FormData();
  formData.append("file", audioBlob, "recording.webm");
  formData.append("model", API_CONFIG.audioModel);
  formData.append("language", "en");
  return formData;
};

/**
 * Send a transcription request to the OpenAI API
 * @param formData The form data with audio file
 * @param apiKey The OpenAI API key
 * @returns The API response
 */
const sendTranscriptionRequest = async (
  formData: FormData,
  apiKey: string,
): Promise<Response> => {
  return await fetch(
    `${API_CONFIG.apiUrl}${API_CONFIG.audioTranscriptionEndpoint}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
    },
  );
};

/**
 * Parse the transcription response
 * @param response The API response
 * @returns The transcribed text
 */
const parseTranscriptionResponse = async (
  response: Response,
): Promise<string> => {
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = response.statusText;

    try {
      const errorData = JSON.parse(errorText);
      errorMessage =
        errorData.error?.message || errorData.message || response.statusText;
    } catch (e) {
      errorMessage = errorText || response.statusText;
    }

    throw new Error(`OpenAI API error: ${errorMessage}`);
  }

  const data: AudioTranscriptionResponse = await response.json();
  return data.text.trim();
};

/**
 * Transcribe audio using OpenAI's Whisper model
 * @param audioBlob The audio recording to transcribe
 * @param apiKey The OpenAI API key
 * @returns The transcribed text
 */
export const transcribeAudio = async (
  audioBlob: Blob,
  apiKey: string,
): Promise<string> => {
  validateApiKey(apiKey);

  try {
    const processedBlob = prepareAudioForTranscription(audioBlob);
    const formData = createTranscriptionFormData(processedBlob);
    const response = await sendTranscriptionRequest(formData, apiKey);
    return await parseTranscriptionResponse(response);
  } catch (error) {
    console.error("Error transcribing audio:", error);
    throw error;
  }
};

// Step 3: Chat completions with audio
/**
 * Create a chat completion request with audio capability
 * @param message The user's message
 * @param history Previous conversation history
 * @param audioOptions Options for audio generation
 * @returns The request body
 */
const createChatCompletionRequest = (
  message: string,
  history: ChatMessage[],
  audioOptions?: AudioOptions,
): ChatCompletionRequest => {
  const messages: ChatMessage[] = [
    { role: "system", content: API_CONFIG.systemPrompt },
    ...history,
    { role: "user", content: message },
  ];

  return {
    model: API_CONFIG.gptModel,
    messages,
    temperature: API_CONFIG.temperature,
    max_tokens: API_CONFIG.max_tokens,
    modalities: ["text", "audio"],
    audio: {
      voice: audioOptions?.voice || "alloy",
      format: audioOptions?.format || "wav",
    },
  };
};

/**
 * Send a chat completion request to the OpenAI API
 * @param requestBody The request body
 * @param apiKey The OpenAI API key
 * @returns The API response
 */
const sendChatCompletionRequest = async (
  requestBody: ChatCompletionRequest,
  apiKey: string,
): Promise<Response> => {
  return await fetch(
    `${API_CONFIG.apiUrl}${API_CONFIG.chatCompletionEndpoint}`,
    {
      method: "POST",
      headers: createApiHeaders(apiKey),
      body: JSON.stringify(requestBody),
    },
  );
};

/**
 * Parse the chat completion response
 * @param response The API response
 * @returns The text and audio data
 */
const parseChatCompletionResponse = async (
  response: Response,
): Promise<GPT4oResponse> => {
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = response.statusText;

    try {
      const errorData = JSON.parse(errorText);
      errorMessage =
        errorData.error?.message || errorData.message || response.statusText;
    } catch (e) {
      errorMessage = errorText || response.statusText;
    }

    throw new Error(`OpenAI API error: ${errorMessage}`);
  }

  const data: ChatCompletionResponse = await response.json();

  if (!data.choices || data.choices.length === 0) {
    throw new Error("No response from OpenAI API");
  }

  const messageChoice = data.choices[0].message;

  // Determine the transcript to display
  let textResponse = "";
  if (
    messageChoice.audio &&
    typeof messageChoice.audio.transcript === "string" &&
    messageChoice.audio.transcript.trim() !== ""
  ) {
    textResponse = messageChoice.audio.transcript.trim();
  } else if (
    typeof messageChoice.content === "string" &&
    messageChoice.content.trim() !== ""
  ) {
    textResponse = messageChoice.content.trim();
  }

  const audioData = messageChoice.audio?.data || null;

  if (!textResponse && !audioData) {
    throw new Error("No response received from API");
  }

  return { text: textResponse, audioData };
};

/**
 * Send a text message to GPT-4o and get text and audio responses
 * @param message The user's text message
 * @param conversationHistory Previous messages in the conversation
 * @param apiKey The OpenAI API key
 * @param audioOptions Options for audio response
 * @returns The GPT-4o response with text and audio
 */
export const sendMessageToGPT4o = async (
  message: string,
  conversationHistory: ChatMessage[] = [],
  apiKey: string,
  audioOptions?: AudioOptions,
): Promise<GPT4oResponse> => {
  validateApiKey(apiKey);

  const requestBody = createChatCompletionRequest(
    message,
    conversationHistory,
    audioOptions,
  );

  try {
    const response = await sendChatCompletionRequest(requestBody, apiKey);
    return await parseChatCompletionResponse(response);
  } catch (error) {
    console.error("Error calling GPT-4o API:", error);
    throw error;
  }
};

// Step 4: Combined audio workflow
/**
 * Process a full audio workflow: transcribe user audio, get GPT-4o response
 * @param audioBlob The user's audio recording
 * @param conversationHistory Previous messages in the conversation
 * @param apiKey The OpenAI API key
 * @param audioOptions Options for audio response
 * @returns The transcription, text response, and audio data
 */
export const sendAudioToGPT4o = async (
  audioBlob: Blob,
  conversationHistory: ChatMessage[] = [],
  apiKey: string,
  audioOptions?: AudioOptions,
): Promise<GPT4oAudioResponse> => {
  validateApiKey(apiKey);

  try {
    // Step 1: Transcribe the audio
    console.log("Transcribing audio...");
    const transcription = await transcribeAudio(audioBlob, apiKey);
    console.log("Transcription result:", transcription);

    if (!transcription || transcription.trim() === "") {
      throw new Error(
        "Could not transcribe audio. Please try speaking more clearly.",
      );
    }

    // Step 2: Get text and audio response from GPT-4o
    console.log("Getting response from GPT-4o...");
    const response = await sendMessageToGPT4o(
      transcription,
      conversationHistory,
      apiKey,
      audioOptions,
    );

    return {
      transcription,
      textResponse: response.text,
      audioData: response.audioData,
    };
  } catch (error) {
    console.error("Error processing audio with GPT-4o:", error);
    throw error;
  }
};

// Step 5: Utility functions
/**
 * Format conversation history for the OpenAI API
 * @param messages Array of messages in a simplified format
 * @returns Messages formatted for the OpenAI API
 */
export const formatConversationHistory = (
  messages: SimpleMessage[],
): ChatMessage[] => {
  return messages.map((msg) => ({
    role: msg.sender === "user" ? "user" : "assistant",
    content: msg.content,
  }));
};

// Default export for backward compatibility
export default {
  transcribeAudio,
  sendMessageToGPT4o,
  sendAudioToGPT4o,
  formatConversationHistory,
};
