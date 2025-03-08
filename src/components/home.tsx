import React, { useState } from "react";
import VoiceChatInterface from "./VoiceChat/VoiceChatInterface";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { AlertCircle } from "lucide-react";

type Message = {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
  status?: "sending" | "sent" | "error";
};

const Home = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      content: "Hello! I'm your AI voice assistant. How can I help you today?",
      sender: "ai",
      timestamp: new Date(),
      status: "sent",
    },
  ]);
  const [apiError, setApiError] = useState<string | null>(null);

  // Get the OpenAI API key from environment variables
  // In a real application, you would use a more secure method to store and retrieve API keys
  const apiKey =
    import.meta.env.VITE_OPENAI_API_KEY ||
    "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";

  const handleSendMessage = async (message: string) => {
    // This function is now handled inside the VoiceChatInterface component
    // We're keeping it here for compatibility with the component props
    console.log("Message sent from Home component:", message);
  };

  // Validate API key format
  const isValidApiKey =
    apiKey && (apiKey.startsWith("sk-") || apiKey.startsWith("sk-proj-"));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <header className="w-full max-w-4xl mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Voice Chat Assistant
        </h1>
        <p className="text-gray-600">
          Speak naturally with an AI assistant powered by OpenAI's Whisper and
          GPT-3.5 models
        </p>
      </header>

      <main className="w-full max-w-4xl flex-1">
        {apiError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>API Error</AlertTitle>
            <AlertDescription>{apiError}</AlertDescription>
          </Alert>
        )}

        {!isValidApiKey ? (
          <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
            <h2 className="text-xl font-semibold text-yellow-800 mb-2">
              OpenAI API Key Required
            </h2>
            <p className="mb-4 text-yellow-700">
              To use this voice chat assistant, you need to provide a valid
              OpenAI API key with access to the Whisper and GPT-3.5 models.
            </p>
            <p className="text-sm text-yellow-600">
              Set the VITE_OPENAI_API_KEY environment variable in your .env file
              or .env.local file. The key should start with "sk-".
            </p>
          </div>
        ) : (
          <VoiceChatInterface
            initialMessages={messages}
            onSendMessage={handleSendMessage}
            apiKey={apiKey}
          />
        )}
      </main>

      <footer className="w-full max-w-4xl mt-8 text-center text-sm text-gray-500">
        <p>Powered by OpenAI's Whisper and GPT-3.5 models</p>
      </footer>
    </div>
  );
};

export default Home;
