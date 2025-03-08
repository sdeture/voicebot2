/**
 * Audio recording service for voice chat functionality
 * Uses the Web Audio API to record audio from the microphone
 */

type RecordingOptions = {
  audioBitsPerSecond?: number;
  mimeType?: string;
};

type RecordingListeners = {
  onStart?: () => void;
  onStop?: (audioBlob: Blob) => void;
  onDataAvailable?: (audioChunk: Blob) => void;
  onError?: (error: Error) => void;
};

// Check if the browser supports audio recording
export const isAudioRecordingSupported = (): boolean => {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
};

// Create an audio recorder instance
export const createAudioRecorder = (
  options: RecordingOptions = {},
  listeners: RecordingListeners = {},
) => {
  // Default options
  const defaultOptions = {
    audioBitsPerSecond: 128000,
    mimeType: "audio/webm",
  };

  const mergedOptions = { ...defaultOptions, ...options };
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let stream: MediaStream | null = null;

  // Initialize the recorder
  const initialize = async (): Promise<void> => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Check if the preferred mimeType is supported
      let mimeType = mergedOptions.mimeType;
      if (MediaRecorder.isTypeSupported(mimeType)) {
        mediaRecorder = new MediaRecorder(stream, {
          audioBitsPerSecond: mergedOptions.audioBitsPerSecond,
          mimeType,
        });
      } else {
        // Fallback to default type
        console.warn(`MimeType ${mimeType} not supported, using default`);
        mediaRecorder = new MediaRecorder(stream);
      }

      // Set up event listeners
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
          if (listeners.onDataAvailable) {
            listeners.onDataAvailable(event.data);
          }
        }
      };

      mediaRecorder.onstart = () => {
        audioChunks = [];
        if (listeners.onStart) {
          listeners.onStart();
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, {
          type: mediaRecorder?.mimeType || "audio/webm",
        });
        if (listeners.onStop) {
          listeners.onStop(audioBlob);
        }
      };

      mediaRecorder.onerror = (event) => {
        if (listeners.onError) {
          listeners.onError(new Error(`MediaRecorder error: ${event.error}`));
        }
      };
    } catch (error) {
      if (listeners.onError) {
        listeners.onError(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
      throw error;
    }
  };

  // Start recording
  const start = async (timeslice?: number): Promise<void> => {
    if (!mediaRecorder) {
      await initialize();
    }

    if (mediaRecorder?.state === "inactive") {
      mediaRecorder?.start(timeslice);
    }
  };

  // Stop recording
  const stop = (): void => {
    if (mediaRecorder?.state !== "inactive") {
      mediaRecorder?.stop();
    }
  };

  // Clean up resources
  const cleanup = (): void => {
    if (mediaRecorder?.state !== "inactive") {
      mediaRecorder?.stop();
    }

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }

    mediaRecorder = null;
    audioChunks = [];
  };

  // Get the current recording state
  const getState = (): "inactive" | "recording" | "paused" | null => {
    return mediaRecorder ? mediaRecorder.state : null;
  };

  return {
    initialize,
    start,
    stop,
    cleanup,
    getState,
  };
};

// Helper function to record audio and return a promise with the audio blob
export const recordAudio = (
  options: RecordingOptions = {},
  maxDuration = 60000, // Default max duration: 60 seconds
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      let recorder: ReturnType<typeof createAudioRecorder> | null = null;
      let recordingTimeout: NodeJS.Timeout | null = null;

      const cleanup = () => {
        if (recordingTimeout) {
          clearTimeout(recordingTimeout);
          recordingTimeout = null;
        }
        if (recorder) {
          recorder.cleanup();
          recorder = null;
        }
      };

      recorder = createAudioRecorder(options, {
        onStop: (audioBlob) => {
          cleanup();
          resolve(audioBlob);
        },
        onError: (error) => {
          cleanup();
          reject(error);
        },
      });

      // Start recording
      recorder.start();

      // Set a timeout to stop recording after maxDuration
      recordingTimeout = setTimeout(() => {
        if (recorder) {
          recorder.stop();
        }
      }, maxDuration);
    } catch (error) {
      reject(error);
    }
  });
};

export default {
  createAudioRecorder,
  recordAudio,
  isAudioRecordingSupported,
};
