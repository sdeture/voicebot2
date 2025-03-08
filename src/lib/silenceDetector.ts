/**
 * Silence detection service for voice chat functionality
 * Detects periods of silence in audio input to automatically end recording
 */

type SilenceDetectorOptions = {
  silenceThreshold?: number; // Volume threshold to consider as silence (0-1)
  silenceDuration?: number; // Duration of silence to trigger callback (ms)
  checkInterval?: number; // How often to check for silence (ms)
};

type SilenceDetectorListeners = {
  onSilenceDetected?: () => void;
  onSpeechDetected?: () => void;
  onError?: (error: Error) => void;
};

/**
 * Creates a silence detector that monitors audio input and triggers callbacks
 * when silence or speech is detected
 */
export const createSilenceDetector = (
  options: SilenceDetectorOptions = {},
  listeners: SilenceDetectorListeners = {},
) => {
  // Default options
  const defaultOptions = {
    silenceThreshold: 0.05, // Default threshold (0-1)
    silenceDuration: 5000, // 5 seconds of silence by default
    checkInterval: 100, // Check every 100ms
  };

  const mergedOptions = { ...defaultOptions, ...options };

  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let microphone: MediaStreamAudioSourceNode | null = null;
  let stream: MediaStream | null = null;
  let silenceTimer: NodeJS.Timeout | null = null;
  let checkIntervalTimer: NodeJS.Timeout | null = null;
  let isSilent = false;
  let isInitialized = false;
  let isRunning = false;
  let silenceDetectedFlag = false;

  // Initialize the silence detector
  const initialize = async (): Promise<void> => {
    try {
      if (isInitialized) return;

      // Get user media
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create audio context and analyzer
      audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      // Connect microphone to analyzer
      microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);

      isInitialized = true;
      silenceDetectedFlag = false;
    } catch (error) {
      if (listeners.onError) {
        listeners.onError(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
      throw error;
    }
  };

  // Start monitoring for silence
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

    // If silence duration is 0, trigger silence detection immediately when silence is detected
    const immediateMode = mergedOptions.silenceDuration === 0;

    // Start checking for silence at regular intervals
    checkIntervalTimer = setInterval(() => {
      if (!analyser || !isRunning) return;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);

      // Calculate average volume level (0-255)
      const average =
        dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;

      // Normalize to 0-1 range
      const normalizedVolume = average / 255;

      // Check if current volume is below threshold (silence)
      if (normalizedVolume < mergedOptions.silenceThreshold) {
        if (!isSilent) {
          console.log("Silence started, starting timer...");
          isSilent = true;

          // If in immediate mode (silenceDuration = 0), trigger callback right away
          if (mergedOptions.silenceDuration === 0) {
            if (isRunning && !silenceDetectedFlag) {
              console.log("Immediate silence detection, triggering callback");
              silenceDetectedFlag = true;
              if (listeners.onSilenceDetected) {
                listeners.onSilenceDetected();
              }
            }
          } else {
            // Start silence timer for normal mode
            silenceTimer = setTimeout(() => {
              if (isRunning && !silenceDetectedFlag) {
                console.log("Silence timer completed, triggering callback");
                silenceDetectedFlag = true;
                if (listeners.onSilenceDetected) {
                  listeners.onSilenceDetected();
                }
              }
            }, mergedOptions.silenceDuration);
          }
        }
      } else {
        // If there was silence but now there's sound
        if (isSilent) {
          console.log("Speech detected, canceling silence timer");
          isSilent = false;
          if (silenceTimer) {
            clearTimeout(silenceTimer);
            silenceTimer = null;
          }
          if (listeners.onSpeechDetected) {
            listeners.onSpeechDetected();
          }
        }
      }
    }, mergedOptions.checkInterval);
  };

  // Stop monitoring for silence
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

  // Clean up resources
  const cleanup = (): void => {
    stop();

    if (microphone) {
      microphone.disconnect();
      microphone = null;
    }

    if (analyser) {
      analyser = null;
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

export default {
  createSilenceDetector,
};
