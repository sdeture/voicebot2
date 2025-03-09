/********************************************************************
 * OpenAI API Integration for Voice Chat with GPT-4o
 * -------------------------------------------------
 * This module handles communication with the OpenAI API,
 * specifically focused on the GPT-4o model with audio response
 * capabilities.
 ********************************************************************/

/********************************************************************
 * Type Definitions
 ********************************************************************/

// Represents a single chat message in the conversation
type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  // Audio object for responses that include audio
  audio?: {
    id?: string;
    expires_at?: number;
    data?: string; // Base64-encoded audio data
    transcript?: string;
  };
};

// Structure for a chat completion request to the API
type ChatCompletionRequest = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  modalities?: string[]; // Output modalities (e.g., ["text", "audio"])
  audio?: {
    voice?: string; // Which voice to use (e.g., "alloy")
    format?: string; // Output audio format (e.g., "wav")
  };
};

// Structure for the chat completion response returned by the API
type ChatCompletionResponse = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: ChatMessage; // May include audio
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

// Structure for audio transcription responses
type AudioTranscriptionResponse = {
  text: string;
};

/********************************************************************
 * API Configuration
 ********************************************************************/
const OPENAI_CONFIG = {
  apiUrl: "https://api.openai.com/v1",
  chatCompletionEndpoint: "/chat/completions",
  audioTranscriptionEndpoint: "/audio/transcriptions",
  audioModel: "whisper-1", // For transcription
  gptModel: "gpt-4o-audio-preview", // Updated to use GPT-4o
  systemPrompt:
    "You are a helpful voice assistant. Provide concise and informative responses.",
  temperature: 0.7,
  max_tokens: 150,
};

/********************************************************************
 * Function: transcribeAudio
 * -------------------------
 * Uses OpenAI's Whisper model to transcribe audio recordings.
 ********************************************************************/
export const transcribeAudio = async (
  audioBlob: Blob,
  apiKey: string,
): Promise<string> => {
  if (!apiKey) {
    throw new Error("OpenAI API key is required");
  }

  try {
    let processedBlob = audioBlob;
    if (audioBlob.type !== "audio/mp3" && audioBlob.type !== "audio/mpeg") {
      processedBlob = new Blob([audioBlob], { type: "audio/webm" });
    }

    const formData = new FormData();
    formData.append("file", processedBlob, "recording.webm");
    formData.append("model", OPENAI_CONFIG.audioModel);
    formData.append("language", "en");

    const response = await fetch(
      `${OPENAI_CONFIG.apiUrl}${OPENAI_CONFIG.audioTranscriptionEndpoint}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      },
    );

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

    const data: AudioTranscriptionResponse = await response.json().catch(() => {
      throw new Error("Failed to parse API response");
    });

    return data.text.trim();
  } catch (error) {
    console.error("Error transcribing audio:", error);
    throw error;
  }
};

/********************************************************************
 * Function: sendAudioToGPT4o
 * --------------------------
 * Main function for the audio-enabled voice chat workflow:
 * 1. Transcribes the user's audio to text.
 * 2. Sends the transcribed text to GPT-4o.
 * 3. Returns both text and audio responses from GPT-4o.
 ********************************************************************/
export const sendAudioToGPT4o = async (
  audioBlob: Blob,
  conversationHistory: ChatMessage[] = [],
  apiKey: string,
  audioOptions?: { voice?: string; format?: string },
): Promise<{
  transcription: string;
  textResponse: string;
  audioData: string | null;
}> => {
  if (!apiKey) {
    throw new Error("OpenAI API key is required");
  }

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
    console.log("Response received:", {
      textLength: response.text ? response.text.length : 0,
      hasAudio: !!response.audioData,
    });

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

/********************************************************************
 * Function: sendMessageToGPT4o
 * ----------------------------
 * Sends a text message to GPT-4o and requests both text and audio
 * responses.
 ********************************************************************/
export const sendMessageToGPT4o = async (
  message: string,
  conversationHistory: ChatMessage[] = [],
  apiKey: string,
  audioOptions?: { voice?: string; format?: string },
): Promise<{ text: string; audioData: string | null }> => {
  if (!apiKey) {
    throw new Error("OpenAI API key is required");
  }

  // Prepare conversation messages with system prompt
  const messages: ChatMessage[] = [
    { role: "system", content: OPENAI_CONFIG.systemPrompt },
    ...conversationHistory,
    { role: "user", content: message },
  ];

  // Prepare request payload with modalities and audio options
  const requestBody: ChatCompletionRequest = {
    model: OPENAI_CONFIG.gptModel,
    messages,
    temperature: OPENAI_CONFIG.temperature,
    max_tokens: OPENAI_CONFIG.max_tokens,
    modalities: ["text", "audio"], // Request both text and audio output
    audio: {
      voice: audioOptions?.voice || "alloy", // Default voice
      format: audioOptions?.format || "wav", // Default output format
    },
  };

  console.log("Sending request to OpenAI:", {
    model: requestBody.model,
    messageCount: messages.length,
    lastUserMessage:
      messages
        .filter((m) => m.role === "user")
        .pop()
        ?.content.substring(0, 50) + "...",
    modalities: requestBody.modalities,
    audioOptions: requestBody.audio,
  });

  try {
    // Send the request to the chat completions endpoint
    const response = await fetch(
      `${OPENAI_CONFIG.apiUrl}${OPENAI_CONFIG.chatCompletionEndpoint}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
      },
    );

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

    // Parse the response JSON
    const data: ChatCompletionResponse = await response.json().catch(() => {
      throw new Error("Failed to parse API response");
    });

    if (!data.choices || data.choices.length === 0) {
      throw new Error("No response from OpenAI API");
    }

    // Log the full response structure to debug
    console.log(
      "Full GPT-4o response structure:",
      JSON.stringify(data, null, 2),
    );
    console.log("First choice message:", data.choices[0].message);

    // Extract text and audio data from the response
    const messageChoice = data.choices[0].message;

    // Determine the transcript to display:
    // Prefer the transcript provided in the audio object if available.
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

    console.log("GPT-4o response extracted:", {
      textResponse: textResponse
        ? textResponse.substring(0, 50) + "..."
        : "<no text>",
      hasAudio: !!audioData,
    });

    return { text: textResponse, audioData };
  } catch (error) {
    console.error("Error calling GPT-4o API:", error);
    throw error;
  }
};

/********************************************************************
 * Function: formatConversationHistory
 * -----------------------------------
 * Utility function to convert the conversation history into
 * the format expected by the OpenAI API.
 ********************************************************************/
export const formatConversationHistory = (
  messages: Array<{ content: string; sender: "user" | "ai" }>,
): ChatMessage[] => {
  return messages.map((msg) => ({
    role: msg.sender === "user" ? "user" : "assistant",
    content: msg.content,
  }));
};

/********************************************************************
 * Default Export
 ********************************************************************/
export default {
  transcribeAudio,
  sendMessageToGPT4o,
  sendAudioToGPT4o,
  formatConversationHistory,
};
