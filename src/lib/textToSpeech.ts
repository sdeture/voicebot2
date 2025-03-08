/**
 * Text-to-Speech service for voice chat functionality
 * Uses the Web Speech API to convert text to speech
 */

type SpeechOptions = {
  voice?: SpeechSynthesisVoice;
  rate?: number;
  pitch?: number;
  volume?: number;
};

// Get available voices
export const getVoices = (): Promise<SpeechSynthesisVoice[]> => {
  return new Promise((resolve) => {
    // Check if voices are already available
    let voices = window.speechSynthesis.getVoices();

    if (voices.length > 0) {
      return resolve(voices);
    }

    // If voices aren't loaded yet, wait for them
    window.speechSynthesis.onvoiceschanged = () => {
      voices = window.speechSynthesis.getVoices();
      resolve(voices);
    };
  });
};

// Get a specific voice by language or name
export const getVoiceByLang = async (
  lang = "en-US",
  preferredName?: string,
): Promise<SpeechSynthesisVoice | null> => {
  const voices = await getVoices();

  // First try to find the preferred voice by name
  if (preferredName) {
    const preferredVoice = voices.find(
      (voice) =>
        voice.name.includes(preferredName) && voice.lang.includes(lang),
    );
    if (preferredVoice) return preferredVoice;
  }

  // Otherwise find any voice for the language
  const langVoice = voices.find((voice) => voice.lang.includes(lang));
  return langVoice || null;
};

// Speak text using the Web Speech API
export const speak = async (
  text: string,
  options: SpeechOptions = {},
): Promise<{
  start: () => void;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  onEnd: (callback: () => void) => void;
}> => {
  // Default options
  const defaultOptions = {
    rate: 1,
    pitch: 1,
    volume: 1,
  };

  const mergedOptions = { ...defaultOptions, ...options };

  // Create speech utterance
  const utterance = new SpeechSynthesisUtterance(text);

  // Set voice if provided, otherwise try to get a default English voice
  if (!mergedOptions.voice) {
    try {
      mergedOptions.voice = await getVoiceByLang("en-US");
    } catch (error) {
      console.error("Error getting voice:", error);
    }
  }

  // Apply options to utterance
  if (mergedOptions.voice) utterance.voice = mergedOptions.voice;
  utterance.rate = mergedOptions.rate;
  utterance.pitch = mergedOptions.pitch;
  utterance.volume = mergedOptions.volume;

  // Create control methods
  const start = () => window.speechSynthesis.speak(utterance);
  const pause = () => window.speechSynthesis.pause();
  const resume = () => window.speechSynthesis.resume();
  const cancel = () => window.speechSynthesis.cancel();

  // Set up end event handler
  const onEnd = (callback: () => void) => {
    utterance.onend = callback;
  };

  return { start, pause, resume, cancel, onEnd };
};

// Check if the browser supports speech synthesis
export const isSpeechSynthesisSupported = (): boolean => {
  return "speechSynthesis" in window;
};

export default {
  speak,
  getVoices,
  getVoiceByLang,
  isSpeechSynthesisSupported,
};
