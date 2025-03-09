/**
 * Silence Detector Service
 * -----------------------
 * Detects periods of silence in audio input to automatically
 * end recording or trigger other actions.
 */

// Types
/**
 * Configuration options for the silence detector
 */
export interface SilenceDetectorOptions {
  /** Volume threshold to consider as silence (0-1, default: 0.05) */
  silenceThreshold?: number;
  /** Duration of silence to trigger callback (ms, default: 5000) */
  silenceDuration?: number;
  /** How often to check for silence (ms, default: 100) */
  checkInterval?: number;
}

/**
 * Event listeners for the silence detector
 */
export interface SilenceDetectorListeners {
  /** Called when silence is detected for the specified duration */
  onSilenceDetected?: () => void;
  /** Called when speech is detected after silence */
  onSpeechDetected?: () => void;
  /** Called when an error occurs */
  onError?: (error: Error) => void;
}

/**
 * Interface for the silence detector instance
 */
export interface SilenceDetector {
  /** Initialize the detector and request audio permissions */
  initialize: () => Promise<void>;
  /** Start monitoring for silence */
  start: () => void;
  /** Stop monitoring for silence */
  stop: () => void;
  /** Clean up resources used by the detector */
  cleanup: () => void;
  /** Check if the detector is currently running */
  isRunning: () => boolean;
  /** Check if silence is currently detected */
  isSilent: () => boolean;
  /** Check if silence has been detected for the threshold duration */
  hasSilenceBeenDetected: () => boolean;
}

// Step 1: Create audio context and analyzer
/**
 * Create a new audio context
 * @returns A new AudioContext instance
 */
const createAudioContext = (): AudioContext => {
  return new (window.AudioContext || (window as any).webkitAudioContext)();
};

/**
 * Create an analyzer node for processing audio
 * @param audioContext The audio context to use
 * @returns A configured AnalyserNode
 */
const createAnalyzer = (audioContext: AudioContext): AnalyserNode => {
  const analyzer = audioContext.createAnalyser();
  analyzer.fftSize = 256;
  analyzer.smoothingTimeConstant = 0.8;

  return analyzer;
};

// Step 2: Connect to microphone
/**
 * Request access to the user's microphone
 * @returns A Promise that resolves with the media stream
 */
const requestMicrophoneAccess = async (): Promise<MediaStream> => {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (error) {
    throw new Error(
      `Microphone access denied: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

/**
 * Connect microphone input to the audio analyzer
 * @param audioContext The audio context
 * @param analyzer The analyzer node
 * @param stream The microphone media stream
 * @returns The microphone source node
 */
const connectMicrophoneToAnalyzer = (
  audioContext: AudioContext,
  analyzer: AnalyserNode,
  stream: MediaStream,
): MediaStreamAudioSourceNode => {
  const microphone = audioContext.createMediaStreamSource(stream);
  microphone.connect(analyzer);

  return microphone;
};

// Step 3: Analyze audio levels
/**
 * Get the current audio level from the analyzer
 * @param analyzer The analyzer node
 * @returns The current audio level, normalized to 0-1
 */
const getCurrentAudioLevel = (analyzer: AnalyserNode): number => {
  const dataArray = new Uint8Array(analyzer.frequencyBinCount);
  analyzer.getByteFrequencyData(dataArray);

  // Calculate average volume level (0-255)
  const average =
    dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;

  // Normalize to 0-1 range
  return average / 255;
};

/**
 * Check if the current audio level indicates silence
 * @param audioLevel The normalized audio level (0-1)
 * @param threshold The silence threshold (0-1)
 * @returns True if the audio level is below the threshold
 */
const isAudioSilent = (audioLevel: number, threshold: number): boolean => {
  return audioLevel < threshold;
};

// Step 4: Manage silence detection state
/**
 * Handle detected silence
 * @param state Detection state variables
 * @param options Silence detector options
 * @param listeners Event listeners
 * @returns Updated silence timer ID
 */
const handleSilence = (
  state: {
    isSilent: boolean;
    silenceTimer: NodeJS.Timeout | null;
    silenceDetectedFlag: boolean;
    isRunning: boolean;
  },
  options: SilenceDetectorOptions,
  listeners: SilenceDetectorListeners,
): NodeJS.Timeout | null => {
  if (!state.isSilent) {
    state.isSilent = true;
    console.log("Silence started, starting timer...");

    // Handle immediate mode (silenceDuration = 0)
    if (options.silenceDuration === 0) {
      if (state.isRunning && !state.silenceDetectedFlag) {
        console.log("Immediate silence detection, triggering callback");
        state.silenceDetectedFlag = true;
        listeners.onSilenceDetected?.();
      }
      return null;
    }

    // Start silence timer for normal mode
    return setTimeout(() => {
      if (state.isRunning && !state.silenceDetectedFlag) {
        console.log("Silence timer completed, triggering callback");
        state.silenceDetectedFlag = true;
        listeners.onSilenceDetected?.();
      }
    }, options.silenceDuration || 5000);
  }

  return state.silenceTimer;
};

/**
 * Handle detected speech
 * @param state Detection state variables
 * @param listeners Event listeners
 */
const handleSpeech = (
  state: {
    isSilent: boolean;
    silenceTimer: NodeJS.Timeout | null;
  },
  listeners: SilenceDetectorListeners,
): void => {
  if (state.isSilent) {
    console.log("Speech detected, canceling silence timer");
    state.isSilent = false;

    if (state.silenceTimer) {
      clearTimeout(state.silenceTimer);
      state.silenceTimer = null;
    }

    listeners.onSpeechDetected?.();
  }
};

// Step 5: Create the silence detector
/**
 * Create a silence detector instance
 * @param options Configuration options
 * @param listeners Event listeners
 * @returns A SilenceDetector instance
 */
export const createSilenceDetector = (
  options: SilenceDetectorOptions = {},
  listeners: SilenceDetectorListeners = {},
): SilenceDetector => {
  // Default options
  const defaultOptions = {
    silenceThreshold: 0.05,
    silenceDuration: 5000,
    checkInterval: 100,
  };

  const mergedOptions = { ...defaultOptions, ...options };

  // State variables
  let audioContext: AudioContext | null = null;
  let analyzer: AnalyserNode | null = null;
  let microphone: MediaStreamAudioSourceNode | null = null;
  let stream: MediaStream | null = null;
  let checkIntervalTimer: NodeJS.Timeout | null = null;
  let silenceTimer: NodeJS.Timeout | null = null;
  let isSilent = false;
  let isInitialized = false;
  let isRunning = false;
  let silenceDetectedFlag = false;

  /**
   * Initialize the silence detector
   */
  const initialize = async (): Promise<void> => {
    try {
      if (isInitialized) return;

      // Step 1-2: Set up audio processing
      stream = await requestMicrophoneAccess();
      audioContext = createAudioContext();
      analyzer = createAnalyzer(audioContext);
      microphone = connectMicrophoneToAnalyzer(audioContext, analyzer, stream);

      isInitialized = true;
      silenceDetectedFlag = false;
    } catch (error) {
      listeners.onError?.(
        error instanceof Error ? error : new Error(String(error)),
      );
      throw error;
    }
  };

  /**
   * Start monitoring for silence
   */
  const start = async (): Promise<void> => {
    if (!isInitialized) {
      await initialize();
    }

    if (isRunning) return;
    isRunning = true;
    silenceDetectedFlag = false;

    // Reset silence state
    isSilent = false;
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }

    // Start checking for silence at regular intervals
    checkIntervalTimer = setInterval(() => {
      if (!analyzer || !isRunning) return;

      // Step 3: Analyze audio levels
      const audioLevel = getCurrentAudioLevel(analyzer);
      const isSoundSilent = isAudioSilent(
        audioLevel,
        mergedOptions.silenceThreshold,
      );

      // Step 4: Handle silence/speech detection
      if (isSoundSilent) {
        silenceTimer = handleSilence(
          { isSilent, silenceTimer, silenceDetectedFlag, isRunning },
          mergedOptions,
          listeners,
        );
      } else {
        handleSpeech({ isSilent, silenceTimer }, listeners);
      }
    }, mergedOptions.checkInterval);
  };

  /**
   * Stop monitoring for silence
   */
  const stop = (): void => {
    isRunning = false;

    if (checkIntervalTimer) {
      clearInterval(checkIntervalTimer);
      checkIntervalTimer = null;
    }

    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
  };

  /**
   * Clean up resources used by the detector
   */
  const cleanup = (): void => {
    stop();

    if (microphone) {
      microphone.disconnect();
      microphone = null;
    }

    if (analyzer) {
      analyzer = null;
    }

    if (audioContext) {
      if (audioContext.state !== "closed") {
        audioContext.close();
      }
      audioContext = null;
    }

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }

    isInitialized = false;
    silenceDetectedFlag = false;
  };

  return {
    initialize,
    start,
    stop,
    cleanup,
    isRunning: () => isRunning,
    isSilent: () => isSilent,
    hasSilenceBeenDetected: () => silenceDetectedFlag,
  };
};

// Default export for backward compatibility
export default {
  createSilenceDetector,
};
