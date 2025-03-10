import React, { useState, useEffect, useRef } from "react";
import ChatHistory from "./ChatHistory";
import VoiceControls from "./VoiceControls";
import StatusIndicator from "./StatusIndicator";
import SilenceSettings from "./SilenceSettings";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { AlertCircle } from "lucide-react";
import * as textToSpeech from "../../services/audio/speech-synthesis.service";
import * as audioRecorder from "../../services/audio/recorder.service";
import * as silenceDetector from "../../services/audio/silence-detector.service";
import * as openai from "../../services/api/openai.service";
import { playBeep } from "../../utils/audio.utils";

// Define the VoiceState type locally
type VoiceState = "idle" | "recording" | "processing" | "speaking" | "error";

type Message = {
  id: string;
  content: string;
  sender: "user" | "ai";
  timestamp: Date;
  status?: "sending" | "sent" | "error";
  errorMessage?: string;
};

interface VoiceChatInterfaceProps {
  className?: string;
  initialMessages?: Message[];
  onSendMessage?: (message: string) => Promise<void>;
  apiKey?: string;
}

const VoiceChatInterface: React.FC<VoiceChatInterfaceProps> = ({
  className = "",
  initialMessages = [],
  onSendMessage = async () => {},
  apiKey = "",
}) => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [transcription, setTranscription] = useState("");
  const [recorder, setRecorder] = useState<ReturnType<
    typeof audioRecorder.createAudioRecorder
  > | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [silenceDetected, setSilenceDetected] = useState(false);
  const [silenceDuration, setSilenceDuration] = useState<number>(5000); // Default: 5 seconds

  // Refs for recording management
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const silenceDetectorRef = useRef<ReturnType<
    typeof silenceDetector.createSilenceDetector
  > | null>(null);
  const MAX_RECORDING_DURATION = 60000; // 60 seconds max recording

  // Helper function for text-to-speech fallback
  const fallbackToTextToSpeech = (text: string) => {
    if (textToSpeech.isSpeechSynthesisSupported()) {
      textToSpeech.speak(text).then((speech) => {
        speech.start();
        speech.onEnd(() => {
          setVoiceState("idle");
          // Reset audio chunks for next recording
          audioChunksRef.current = [];
        });
      });
    } else {
      // If speech synthesis is not supported, just simulate speaking
      setTimeout(() => {
        setVoiceState("idle");
        // Reset audio chunks for next recording
        audioChunksRef.current = [];
      }, 3000);
    }
  };

  // Function to handle API errors
  const handleApiError = (error: any, messageId?: string) => {
    console.error("API Error:", error);

    // Extract the error message
    const errorMsg =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String(error.message)
          : String(error);

    // Set the error state
    setErrorMessage(errorMsg);
    setVoiceState("error");

    // If we have a message ID, update its status
    if (messageId) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, status: "error", errorMessage: errorMsg }
            : msg,
        ),
      );
    }

    // Reset to idle after a delay
    setTimeout(() => {
      setVoiceState("idle");
      setErrorMessage(null);
    }, 5000);
  };

  // Function to process audio and get AI response
  const processAudioAndGetResponse = async (audioBlob: Blob) => {
    if (!apiKey) {
      setErrorMessage(
        "OpenAI API key is required. Please set it in your environment variables.",
      );
      setVoiceState("error");
      setTimeout(() => {
        setVoiceState("idle");
        setErrorMessage(null);
      }, 5000);
      return;
    }

    try {
      // Add a placeholder user message
      const userMessage: Message = {
        id: Date.now().toString(),
        content: "Processing your audio...",
        sender: "user",
        timestamp: new Date(),
        status: "sending",
      };

      setMessages((prev) => [...prev, userMessage]);
      setVoiceState("processing");

      // Send audio to OpenAI for processing
      const formattedHistory = openai.formatConversationHistory(
        messages
          .filter((msg) => msg.status !== "sending" && msg.status !== "error") // Only include successfully processed messages
          .map((msg) => ({
            content: msg.content,
            sender: msg.sender,
          })),
      );

      try {
        // Get response from OpenAI using the GPT-4o audio model
        console.log("Sending audio to OpenAI...");
        const result = await openai.sendAudioToGPT4o(
          audioBlob,
          formattedHistory,
          apiKey,
        );

        const { transcription, textResponse, audioData } = result;
        setTranscription(transcription);

        // Update the user message with the transcription
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === userMessage.id
              ? {
                  ...msg,
                  content: transcription,
                  status: "sent",
                }
              : msg,
          ),
        );

        // Add AI response
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          content: textResponse,
          sender: "ai",
          timestamp: new Date(),
          status: "sent",
        };

        console.log("Adding AI response to chat:", {
          responseId: aiResponse.id,
          content:
            aiResponse.content.substring(0, 50) +
            (aiResponse.content.length > 50 ? "..." : ""),
          hasAudioData: !!audioData,
        });

        setMessages((prev) => [...prev, aiResponse]);
        setVoiceState("speaking");

        // If we have audio data from GPT-4o, use it directly
        if (audioData) {
          try {
            // Convert base64 audio data to a blob
            const byteCharacters = atob(audioData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const audioBlob = new Blob([byteArray], { type: "audio/wav" });

            // Create audio URL and play it
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);

            // Make sure the AI response is visible in the chat before playing audio
            setTimeout(() => {
              audio.play().catch((err) => {
                console.error("Error playing audio:", err);
                fallbackToTextToSpeech(aiResponse.content);
              });
            }, 100);

            audio.onended = () => {
              setVoiceState("idle");
              URL.revokeObjectURL(audioUrl);
              // Reset audio chunks for next recording
              audioChunksRef.current = [];
            };
          } catch (error) {
            console.error("Error playing audio response:", error);
            // Fall back to text-to-speech if audio playback fails
            fallbackToTextToSpeech(aiResponse.content);
          }
        } else {
          // Fall back to text-to-speech if no audio data
          fallbackToTextToSpeech(aiResponse.content);
        }

        // Call the provided onSendMessage function with the transcription
        if (onSendMessage) {
          await onSendMessage(transcription);
        }
      } catch (apiError) {
        console.error("API error in processAudioAndGetResponse:", apiError);
        handleApiError(apiError, userMessage.id);
      }
    } catch (error) {
      console.error("Error processing audio:", error);
      setVoiceState("error");
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setTimeout(() => {
        setVoiceState("idle");
        setErrorMessage(null);
      }, 5000);
    }
  };

  // Function to handle text message submission
  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return;

    if (!apiKey) {
      setErrorMessage(
        "OpenAI API key is required. Please set it in your environment variables.",
      );
      setVoiceState("error");
      setTimeout(() => {
        setVoiceState("idle");
        setErrorMessage(null);
      }, 5000);
      return;
    }

    // Add user message to chat
    const userMessage: Message = {
      id: Date.now().toString(),
      content: message,
      sender: "user",
      timestamp: new Date(),
      status: "sending",
    };

    setMessages((prev) => [...prev, userMessage]);

    try {
      // Set voice state to processing
      setVoiceState("processing");

      // Format conversation history
      const formattedHistory = openai.formatConversationHistory(
        messages
          .filter((msg) => msg.status !== "error") // Filter out error messages
          .map((msg) => ({
            content: msg.content,
            sender: msg.sender,
          })),
      );

      try {
        // Use the GPT-4o audio endpoint
        const { text, audioData } = await openai.sendMessageToGPT4o(
          message,
          formattedHistory,
          apiKey,
          { voice: "alloy", format: "wav" }, // Optional audio parameters
        );

        // Update user message status to sent
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === userMessage.id ? { ...msg, status: "sent" } : msg,
          ),
        );

        // Add AI response with the text returned from the new API call
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          content: text,
          sender: "ai",
          timestamp: new Date(),
          status: "sent",
        };

        console.log("Adding AI text response to chat:", {
          responseId: aiResponse.id,
          content:
            aiResponse.content.substring(0, 50) +
            (aiResponse.content.length > 50 ? "..." : ""),
          hasAudioData: !!audioData,
        });

        setMessages((prev) => [...prev, aiResponse]);
        setVoiceState("speaking");

        // If we have audio data from GPT-4o, use it directly
        if (audioData) {
          try {
            // Convert base64 audio data to a blob
            const byteCharacters = atob(audioData);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const audioBlob = new Blob([byteArray], { type: "audio/wav" });

            // Create audio URL and play it
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);

            // Make sure the AI response is visible in the chat before playing audio
            setTimeout(() => {
              audio.play().catch((err) => {
                console.error("Error playing audio:", err);
                fallbackToTextToSpeech(aiResponse.content);
              });
            }, 100);

            audio.onended = () => {
              setVoiceState("idle");
              URL.revokeObjectURL(audioUrl);
              // Reset audio chunks for next recording
              audioChunksRef.current = [];
            };
          } catch (error) {
            console.error("Error playing audio response:", error);
            // Fall back to text-to-speech if audio playback fails
            fallbackToTextToSpeech(aiResponse.content);
          }
        } else {
          // Fall back to text-to-speech if no audio data
          fallbackToTextToSpeech(aiResponse.content);
        }

        // Call the provided onSendMessage function
        if (onSendMessage) {
          await onSendMessage(message);
        }
      } catch (apiError) {
        handleApiError(apiError, userMessage.id);
      }
    } catch (error) {
      console.error("Error in handleSendMessage:", error);
      setVoiceState("error");
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setTimeout(() => {
        setVoiceState("idle");
        setErrorMessage(null);
      }, 5000);
    }
  };

  // Handle silence detection
  const handleSilenceDetected = () => {
    console.log(
      `Silence detected for ${silenceDuration / 1000} seconds, stopping recording...`,
    );
    setSilenceDetected(true);

    // Ensure we stop recording after a short delay to allow the UI to update
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
    }

    silenceTimeoutRef.current = setTimeout(() => {
      console.log("Executing handleStopRecording after silence detection");
      handleStopRecording();
    }, 500); // Short delay to ensure UI updates first
  };

  // Initialize silence detector
  const initializeSilenceDetector = async () => {
    try {
      const detector = silenceDetector.createSilenceDetector(
        {
          silenceThreshold: 0.05, // Adjust based on testing
          silenceDuration: silenceDuration,
          checkInterval: 100,
        },
        {
          onSilenceDetected: handleSilenceDetected,
          onSpeechDetected: () => {
            console.log("Speech detected");
            setSilenceDetected(false);
          },
          onError: (error) => {
            console.error("Silence detector error:", error);
          },
        },
      );

      await detector.initialize();
      silenceDetectorRef.current = detector;
      return detector;
    } catch (error) {
      console.error("Error initializing silence detector:", error);
      return null;
    }
  };

  // Initialize audio recorder
  const initializeRecorder = async () => {
    if (!audioRecorder.isAudioRecordingSupported()) {
      setErrorMessage("Audio recording is not supported in your browser.");
      setVoiceState("error");
      setTimeout(() => {
        setVoiceState("idle");
        setErrorMessage(null);
      }, 5000);
      return null;
    }

    try {
      // Initialize silence detector first
      if (!silenceDetectorRef.current) {
        await initializeSilenceDetector();
      }

      const newRecorder = audioRecorder.createAudioRecorder(
        { mimeType: "audio/webm" },
        {
          onStart: () => {
            setIsRecording(true);
            setVoiceState("recording");
            audioChunksRef.current = [];
            setTranscription("");
            setErrorMessage(null); // Clear any previous errors
            setSilenceDetected(false);

            // Start silence detection
            if (silenceDetectorRef.current) {
              silenceDetectorRef.current.start();
            }
          },
          onDataAvailable: (chunk) => {
            audioChunksRef.current.push(chunk);
          },
          onStop: async (audioBlob) => {
            setIsRecording(false);
            console.log(
              "Recording stopped, processing audio...",
              audioBlob.type,
              audioBlob.size,
            );

            // Stop silence detection
            if (silenceDetectorRef.current) {
              silenceDetectorRef.current.stop();
            }

            // Clear any pending silence timeout
            if (silenceTimeoutRef.current) {
              clearTimeout(silenceTimeoutRef.current);
              silenceTimeoutRef.current = null;
            }

            await processAudioAndGetResponse(audioBlob);
          },
          onError: (error) => {
            console.error("Recording error:", error);
            setIsRecording(false);
            setVoiceState("error");
            setErrorMessage(`Recording error: ${error.message}`);

            // Stop silence detection
            if (silenceDetectorRef.current) {
              silenceDetectorRef.current.stop();
            }

            // Clear any pending silence timeout
            if (silenceTimeoutRef.current) {
              clearTimeout(silenceTimeoutRef.current);
              silenceTimeoutRef.current = null;
            }

            setTimeout(() => {
              setVoiceState("idle");
              setErrorMessage(null);
            }, 5000);
          },
        },
      );

      await newRecorder.initialize();
      return newRecorder;
    } catch (error) {
      console.error("Error initializing recorder:", error);
      setVoiceState("error");
      setErrorMessage(
        `Could not access microphone: ${error instanceof Error ? error.message : String(error)}`,
      );
      setTimeout(() => {
        setVoiceState("idle");
        setErrorMessage(null);
      }, 5000);
      return null;
    }
  };

  // Start recording
  const handleStartRecording = async () => {
    // If we're already recording or processing, don't start a new recording
    if (
      isRecording ||
      voiceState === "processing" ||
      voiceState === "speaking" ||
      voiceState === "error"
    ) {
      console.log("Cannot start recording in current state:", voiceState);
      return;
    }

    // Reset audio chunks for new recording
    audioChunksRef.current = [];

    try {
      // Initialize recorder if not already initialized
      if (!recorder) {
        const newRecorder = await initializeRecorder();
        if (!newRecorder) return;
        setRecorder(newRecorder);

        // Start recording after a short delay to ensure initialization is complete
        setTimeout(() => {
          newRecorder.start(1000); // Collect data in 1-second chunks

          // Set a timeout to automatically stop recording after MAX_RECORDING_DURATION
          recordingTimeoutRef.current = setTimeout(() => {
            if (newRecorder.getState() === "recording") {
              newRecorder.stop();
            }
          }, MAX_RECORDING_DURATION);
        }, 100);
      } else {
        // Use existing recorder
        recorder.start(1000);

        // Start silence detector
        if (silenceDetectorRef.current) {
          silenceDetectorRef.current.start();
        }

        // Set a timeout to automatically stop recording after MAX_RECORDING_DURATION
        recordingTimeoutRef.current = setTimeout(() => {
          if (recorder.getState() === "recording") {
            recorder.stop();
          }
        }, MAX_RECORDING_DURATION);
      }
    } catch (error) {
      console.error("Error starting recording:", error);
      setVoiceState("error");
      setErrorMessage(
        `Error starting recording: ${error instanceof Error ? error.message : String(error)}`,
      );
      setTimeout(() => {
        setVoiceState("idle");
        setErrorMessage(null);
      }, 5000);
    }
  };

  // Stop recording
  const handleStopRecording = () => {
    console.log("handleStopRecording called");

    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }

    // Stop silence detection
    if (silenceDetectorRef.current && silenceDetectorRef.current.isRunning()) {
      silenceDetectorRef.current.stop();
    }

    if (recorder) {
      if (recorder.getState() === "recording") {
        console.log("Actually stopping the recorder");
        recorder.stop();
        playBeep(); // Play beep immediately after stopping the recorder
      } else {
        console.log("Recorder not in recording state, processing audio chunks");
        playBeep(); // Play beep even if recorder isn't active
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, {
            type: "audio/webm",
          });
          processAudioAndGetResponse(audioBlob);
        } else {
          console.log("No audio chunks available to process.");
        }
      }
    } else {
      console.log("Recorder not available, processing audio chunks if any");
      playBeep(); // Play beep when processing without recorder
      if (audioChunksRef.current.length > 0) {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        processAudioAndGetResponse(audioBlob);
      } else {
        console.log("No audio chunks available to process.");
      }
    }
  };

  // Reinitialize silence detector when silence duration changes
  useEffect(() => {
    if (silenceDetectorRef.current && silenceDetectorRef.current.isRunning()) {
      // If we're currently recording, reinitialize the detector with the new duration
      silenceDetectorRef.current.stop();
      initializeSilenceDetector().then((detector) => {
        if (detector && isRecording) {
          detector.start();
        }
      });
    }
  }, [silenceDuration, isRecording]);

  // Reset recorder when returning to idle state
  useEffect(() => {
    if (voiceState === "idle" && recorder) {
      // Reset recorder state to prepare for next recording
      if (recorder.getState() !== "inactive") {
        recorder.stop();
      }
    }
  }, [voiceState, recorder]);

  // Clean up resources on unmount
  useEffect(() => {
    return () => {
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      if (recorder) {
        recorder.cleanup();
      }
      if (silenceDetectorRef.current) {
        silenceDetectorRef.current.cleanup();
      }
    };
  }, [recorder]);

  return (
    <Card className={`w-full max-w-4xl mx-auto bg-background ${className}`}>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold">Voice Assistant</CardTitle>
          <div className="flex items-center gap-2">
            <SilenceSettings
              silenceDuration={silenceDuration}
              onSilenceDurationChange={setSilenceDuration}
            />
            <StatusIndicator status={voiceState} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-col h-[600px]">
          {errorMessage && (
            <Alert variant="destructive" className="m-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="flex-1 overflow-hidden">
            <ChatHistory messages={messages} className="h-full border-none" />
          </div>

          {voiceState === "recording" && (
            <div className="p-4 bg-muted/50 border-t border-border">
              <p className="text-sm font-medium">Recording your message...</p>
              <p className="text-xs text-muted-foreground mt-1">
                {silenceDetected
                  ? "Silence detected, processing your message..."
                  : silenceDuration === 0
                    ? "Your message will be sent immediately when you stop speaking."
                    : `Your message will be sent automatically after ${silenceDuration / 1000} ${silenceDuration === 1000 ? "second" : "seconds"} of silence.`}
              </p>
            </div>
          )}

          <VoiceControls
            voiceState={voiceState}
            onStartListening={handleStartRecording}
            onStopListening={handleStopRecording}
            onSendMessage={handleSendMessage}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default VoiceChatInterface;
