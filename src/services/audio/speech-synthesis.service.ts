/**
 * Speech Synthesis Service
 * -----------------------
 * Provides text-to-speech functionality using the Web Speech API
 * as a fallback for when audio responses aren't available.
 */

// Types
/**
 * Configuration options for speech synthesis
 */
export interface SpeechOptions {
  /** Voice to use for speech (defaults to first available) */
  voice?: SpeechSynthesisVoice;
  /** Speech rate (0.1 to 10, default: 1) */
  rate?: number;
  /** Speech pitch (0 to 2, default: 1) */
  pitch?: number;
  /** Speech volume (0 to 1, default: 1) */
  volume?: number;
}

/**
 * Speech synthesis event callbacks
 */
export interface SpeechEventHandlers {
  /** Called when speech starts */
  onStart?: () => void;
  /** Called when speech pauses */
  onPause?: () => void;
  /** Called when speech resumes */
  onResume?: () => void;
  /** Called when speech ends */
  onEnd?: () => void;
  /** Called when a speech error occurs */
  onError?: (error: Error) => void;
}

/**
 * Speech synthesis controller
 */
export interface SpeechSynthesisController {
  /** Start speaking */
  start: () => void;
  /** Pause speaking */
  pause: () => void;
  /** Resume speaking after pausing */
  resume: () => void;
  /** Stop speaking */
  stop: () => void;
  /** Set callback for when speech ends */
  onEnd: (callback: () => void) => void;
  /** Set callback for when speech errors occur */
  onError: (callback: (error: Error) => void) => void;
}

// Step 1: Check for browser support
/**
 * Check if speech synthesis is supported in the browser
 * @returns True if speech synthesis is supported
 */
export const isSpeechSynthesisSupported = (): boolean => {
  return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
};

// Step 2: Get available voices
/**
 * Get available speech synthesis voices
 * @returns An array of available voices
 */
export const getAvailableVoices = (): SpeechSynthesisVoice[] => {
  if (!isSpeechSynthesisSupported()) {
    return [];
  }

  return window.speechSynthesis.getVoices();
};

/**
 * Get the default voice for speech synthesis
 * @returns The default voice, or null if none available
 */
export const getDefaultVoice = (): SpeechSynthesisVoice | null => {
  const voices = getAvailableVoices();

  if (voices.length === 0) {
    return null;
  }

  // Try to find an English voice
  const englishVoice = voices.find(
    (voice) => voice.lang.includes("en") && voice.localService,
  );

  return englishVoice || voices[0];
};

// Step 3: Create speech utterance
/**
 * Configure a speech utterance with options
 * @param utterance The SpeechSynthesisUtterance to configure
 * @param options Speech options
 */
const configureSpeechUtterance = (
  utterance: SpeechSynthesisUtterance,
  options: SpeechOptions,
): void => {
  if (options.voice) {
    utterance.voice = options.voice;
  }

  if (options.rate !== undefined) {
    utterance.rate = Math.max(0.1, Math.min(10, options.rate));
  }

  if (options.pitch !== undefined) {
    utterance.pitch = Math.max(0, Math.min(2, options.pitch));
  }

  if (options.volume !== undefined) {
    utterance.volume = Math.max(0, Math.min(1, options.volume));
  }
};

/**
 * Set up event handlers for speech utterance
 * @param utterance The SpeechSynthesisUtterance to configure
 * @param handlers Speech event handlers
 */
const setupSpeechEventHandlers = (
  utterance: SpeechSynthesisUtterance,
  handlers: SpeechEventHandlers,
): void => {
  if (handlers.onStart) {
    utterance.onstart = handlers.onStart;
  }

  if (handlers.onPause) {
    utterance.onpause = handlers.onPause;
  }

  if (handlers.onResume) {
    utterance.onresume = handlers.onResume;
  }

  if (handlers.onEnd) {
    utterance.onend = handlers.onEnd;
  }

  if (handlers.onError) {
    utterance.onerror = (event) => {
      handlers.onError?.(new Error(`Speech synthesis error: ${event.error}`));
    };
  }
};

/**
 * Create a speech utterance from text
 * @param text The text to speak
 * @param options Speech options
 * @param handlers Speech event handlers
 * @returns A configured SpeechSynthesisUtterance
 */
const createSpeechUtterance = (
  text: string,
  options: SpeechOptions = {},
  handlers: SpeechEventHandlers = {},
): SpeechSynthesisUtterance => {
  const utterance = new SpeechSynthesisUtterance(text);

  // Use default voice if none specified
  if (!options.voice) {
    options.voice = getDefaultVoice() || undefined;
  }

  configureSpeechUtterance(utterance, options);
  setupSpeechEventHandlers(utterance, handlers);

  return utterance;
};

// Step 4: Speech synthesis control
/**
 * Create a controller for managing speech synthesis
 * @param utterance The speech utterance to control
 * @returns A controller for the speech
 */
const createSpeechController = (
  utterance: SpeechSynthesisUtterance,
): SpeechSynthesisController => {
  const synthesis = window.speechSynthesis;

  return {
    start: () => {
      // Cancel any ongoing speech
      synthesis.cancel();
      // Start new speech
      synthesis.speak(utterance);
    },

    pause: () => {
      if (synthesis.speaking) {
        synthesis.pause();
      }
    },

    resume: () => {
      if (synthesis.paused) {
        synthesis.resume();
      }
    },

    stop: () => {
      synthesis.cancel();
    },

    onEnd: (callback: () => void) => {
      utterance.onend = callback;
    },

    onError: (callback: (error: Error) => void) => {
      utterance.onerror = (event) => {
        callback(new Error(`Speech synthesis error: ${event.error}`));
      };
    },
  };
};

// Step 5: Main speech function
/**
 * Convert text to speech
 * @param text The text to speak
 * @param options Speech options
 * @param handlers Speech event handlers
 * @returns A controller for managing the speech
 */
export const speak = (
  text: string,
  options: SpeechOptions = {},
  handlers: SpeechEventHandlers = {},
): SpeechSynthesisController => {
  if (!isSpeechSynthesisSupported()) {
    const errorMsg = "Speech synthesis is not supported in this browser";
    handlers.onError?.(new Error(errorMsg));
    throw new Error(errorMsg);
  }

  const utterance = createSpeechUtterance(text, options, handlers);
  return createSpeechController(utterance);
};

// Default export for backward compatibility
export default {
  speak,
  isSpeechSynthesisSupported,
  getAvailableVoices,
  getDefaultVoice,
};
