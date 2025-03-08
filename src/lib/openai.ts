/**
 * OpenAI API integration for voice chat functionality
 * Handles sending user queries to the API and processing responses
 */

// Define types for OpenAI API requests and responses
type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type ChatCompletionRequest = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
};

type ChatCompletionResponse = {
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
};

type AudioTranscriptionResponse = {
  text: string;
};

/**
 * Configuration for OpenAI API
 */
const OPENAI_CONFIG = {
  apiUrl: "https://api.openai.com/v1",
  chatCompletionEndpoint: "/chat/completions",
  audioTranscriptionEndpoint: "/audio/transcriptions",
  audioCompletionEndpoint: "/audio/speech",
  audioModel: "whisper-1", // Using Whisper for audio transcription
  chatModel: "gpt-3.5-turbo", // Using GPT-3.5 for chat responses
  systemPrompt:
    "You are a helpful voice assistant. Provide concise and informative responses.",
  temperature: 0.7,
  max_tokens: 150,
};

/**
 * Sends a message to OpenAI API and returns the response
 * @param message - The user's message to send to the API
 * @param conversationHistory - Previous messages in the conversation
 * @param apiKey - OpenAI API key
 */
export const sendMessageToOpenAI = async (
  message: string,
  conversationHistory: ChatMessage[] = [],
  apiKey: string,
): Promise<string> => {
  if (!apiKey) {
    throw new Error("OpenAI API key is required");
  }

  // Prepare the messages array with system prompt and conversation history
  const messages: ChatMessage[] = [
    { role: "system", content: OPENAI_CONFIG.systemPrompt },
    ...conversationHistory,
    { role: "user", content: message },
  ];

  // Prepare the request payload
  const requestBody: ChatCompletionRequest = {
    model: OPENAI_CONFIG.chatModel,
    messages,
    temperature: OPENAI_CONFIG.temperature,
    max_tokens: OPENAI_CONFIG.max_tokens,
  };

  try {
    // Send request to OpenAI API
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
        // If we can't parse the error as JSON, use the raw text
        errorMessage = errorText || response.statusText;
      }

      throw new Error(`OpenAI API error: ${errorMessage}`);
    }

    const data: ChatCompletionResponse = await response.json().catch(() => {
      throw new Error("Failed to parse API response");
    });

    if (!data.choices || data.choices.length === 0) {
      throw new Error("No response from OpenAI API");
    }

    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    throw error;
  }
};

/**
 * Transcribes audio using OpenAI's audio API
 * @param audioBlob - The audio blob to transcribe
 * @param apiKey - OpenAI API key
 */
export const transcribeAudio = async (
  audioBlob: Blob,
  apiKey: string,
): Promise<string> => {
  if (!apiKey) {
    throw new Error("OpenAI API key is required");
  }

  try {
    // Convert audio to MP3 format if needed (browser compatibility)
    let processedBlob = audioBlob;
    if (audioBlob.type !== "audio/mp3" && audioBlob.type !== "audio/mpeg") {
      // Use webm as is, OpenAI supports it
      processedBlob = new Blob([audioBlob], { type: "audio/webm" });
    }

    // Create a FormData object to send the audio file
    const formData = new FormData();
    formData.append("file", processedBlob, "recording.webm");
    formData.append("model", OPENAI_CONFIG.audioModel);
    formData.append("language", "en"); // Specify language (optional)

    // Send request to OpenAI API
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
        // If we can't parse the error as JSON, use the raw text
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

/**
 * Process audio with OpenAI: first transcribe, then get a response
 * @param audioBlob - The audio blob to process
 * @param conversationHistory - Previous messages in the conversation
 * @param apiKey - OpenAI API key
 */
export const sendAudioToOpenAI = async (
  audioBlob: Blob,
  conversationHistory: ChatMessage[] = [],
  apiKey: string,
): Promise<{ transcription: string; response: string }> => {
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

    // Step 2: Send the transcription to get a response
    console.log("Getting response for transcription...");
    const response = await sendMessageToOpenAI(
      transcription,
      conversationHistory,
      apiKey,
    );
    console.log("Response received:", response);

    return {
      transcription,
      response,
    };
  } catch (error) {
    console.error("Error processing audio:", error);
    throw error;
  }
};

/**
 * Creates a streaming connection to OpenAI API
 * @param message - The user's message to send to the API
 * @param conversationHistory - Previous messages in the conversation
 * @param apiKey - OpenAI API key
 * @param onChunk - Callback function to handle each chunk of the response
 * @param onComplete - Callback function called when the stream is complete
 */
export const streamMessageFromOpenAI = async (
  message: string,
  conversationHistory: ChatMessage[] = [],
  apiKey: string,
  onChunk: (chunk: string) => void,
  onComplete: (fullResponse: string) => void,
): Promise<void> => {
  if (!apiKey) {
    throw new Error("OpenAI API key is required");
  }

  // Prepare the messages array with system prompt and conversation history
  const messages: ChatMessage[] = [
    { role: "system", content: OPENAI_CONFIG.systemPrompt },
    ...conversationHistory,
    { role: "user", content: message },
  ];

  // Prepare the request payload with streaming enabled
  const requestBody: ChatCompletionRequest = {
    model: OPENAI_CONFIG.chatModel,
    messages,
    temperature: OPENAI_CONFIG.temperature,
    max_tokens: OPENAI_CONFIG.max_tokens,
    stream: true,
  };

  try {
    // Send request to OpenAI API
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
        // If we can't parse the error as JSON, use the raw text
        errorMessage = errorText || response.statusText;
      }

      throw new Error(`OpenAI API error: ${errorMessage}`);
    }

    // Handle the stream response
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("Failed to get response reader");
    }

    const decoder = new TextDecoder("utf-8");
    let fullResponse = "";

    // Process the stream chunks
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter((line) => line.trim() !== "");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content || "";
            if (content) {
              onChunk(content);
              fullResponse += content;
            }
          } catch (e) {
            console.error("Error parsing stream data:", e);
          }
        }
      }
    }

    onComplete(fullResponse);
  } catch (error) {
    console.error("Error streaming from OpenAI API:", error);
    throw error;
  }
};

/**
 * Utility function to format conversation history for OpenAI API
 * @param messages - Array of user and AI messages
 */
export const formatConversationHistory = (
  messages: Array<{ content: string; sender: "user" | "ai" }>,
): ChatMessage[] => {
  return messages.map((msg) => ({
    role: msg.sender === "user" ? "user" : "assistant",
    content: msg.content,
  }));
};

export default {
  sendMessageToOpenAI,
  streamMessageFromOpenAI,
  formatConversationHistory,
  transcribeAudio,
  sendAudioToOpenAI,
};
