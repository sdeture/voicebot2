/**
 * Audio Recorder Service
 * -------------------
 * Provides functionality for recording audio from the user's microphone
 * using the Web Audio API.
 */

// Types
/**
 * Options for configuring the audio recorder
 */
export interface RecordingOptions {
  /** Bits per second for audio encoding (default: 128000) */
  audioBitsPerSecond?: number;
  /** MIME type for the recorded audio (default: "audio/webm") */
  mimeType?: string;
}

/**
 * Event listeners for the audio recorder
 */
export interface RecordingListeners {
  /** Called when recording starts */
  onStart?: () => void;
  /** Called when recording stops, with the resulting audio blob */
  onStop?: (audioBlob: Blob) => void;
  /** Called when a chunk of audio data becomes available */
  onDataAvailable?: (audioChunk: Blob) => void;
  /** Called when an error occurs during recording */
  onError?: (error: Error) => void;
}

/**
 * Interface for the audio recorder instance
 */
export interface AudioRecorder {
  /** Initialize the recorder and request microphone permissions */
  initialize: () => Promise<void>;
  /** Start recording audio */
  start: (timeslice?: number) => Promise<void>;
  /** Stop recording audio */
  stop: () => void;
  /** Clean up resources used by the recorder */
  cleanup: () => void;
  /** Get the current state of the recorder */
  getState: () => "inactive" | "recording" | "paused" | null;
}

// Step 1: Check browser support
/**
 * Check if the browser supports audio recording
 * @returns True if audio recording is supported, false otherwise
 */
export const isAudioRecordingSupported = (): boolean => {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
};

// Step 2: Access microphone
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

// Step 3: Select MIME type
/**
 * Determine the appropriate MIME type for recording
 * @param preferredType Preferred MIME type to use
 * @returns A supported MIME type
 */
const selectSupportedMimeType = (preferredType: string): string => {
  if (MediaRecorder.isTypeSupported(preferredType)) {
    return preferredType;
  }

  console.warn(`MimeType ${preferredType} not supported, using default`);
  return "";
};

// Step 4: Create recorder
/**
 * Create a MediaRecorder with the selected options
 * @param stream The media stream to record
 * @param options Recording options
 * @returns A new MediaRecorder instance
 */
const createMediaRecorder = (
  stream: MediaStream,
  options: RecordingOptions,
): MediaRecorder => {
  const defaultOptions = {
    audioBitsPerSecond: 128000,
    mimeType: "audio/webm",
  };

  const mergedOptions = { ...defaultOptions, ...options };
  const mimeType = selectSupportedMimeType(mergedOptions.mimeType);

  if (mimeType) {
    return new MediaRecorder(stream, {
      audioBitsPerSecond: mergedOptions.audioBitsPerSecond,
      mimeType,
    });
  } else {
    return new MediaRecorder(stream);
  }
};

// Step 5: Handle recorder events
/**
 * Handle data available event
 */
const handleDataAvailable = (
  event: BlobEvent,
  audioChunks: Blob[],
  onDataAvailable?: (chunk: Blob) => void,
): void => {
  if (event.data.size > 0) {
    audioChunks.push(event.data);
    onDataAvailable?.(event.data);
  }
};

/**
 * Handle recording start event
 */
const handleRecordingStart = (
  audioChunks: Blob[],
  onStart?: () => void,
): void => {
  audioChunks.length = 0; // Clear the array
  onStart?.();
};

/**
 * Handle recording stop event
 */
const handleRecordingStop = (
  audioChunks: Blob[],
  mimeType: string,
  onStop?: (blob: Blob) => void,
): void => {
  const audioBlob = new Blob(audioChunks, { type: mimeType || "audio/webm" });
  onStop?.(audioBlob);
};

/**
 * Handle recording error event
 */
const handleRecordingError = (
  event: MediaRecorderErrorEvent,
  onError?: (error: Error) => void,
): void => {
  onError?.(new Error(`MediaRecorder error: ${event.error}`));
};

/**
 * Set up all event listeners for the MediaRecorder
 */
const setupRecorderEventListeners = (
  mediaRecorder: MediaRecorder,
  audioChunks: Blob[],
  listeners: RecordingListeners,
): void => {
  mediaRecorder.ondataavailable = (event) =>
    handleDataAvailable(event, audioChunks, listeners.onDataAvailable);

  mediaRecorder.onstart = () =>
    handleRecordingStart(audioChunks, listeners.onStart);

  mediaRecorder.onstop = () =>
    handleRecordingStop(audioChunks, mediaRecorder.mimeType, listeners.onStop);

  mediaRecorder.onerror = (event) =>
    handleRecordingError(event, listeners.onError);
};

// Step 6: Create main recorder interface
/**
 * Create an audio recorder instance
 * @param options Configuration options for the recorder
 * @param listeners Event listeners for recording events
 * @returns An AudioRecorder instance
 */
export const createAudioRecorder = (
  options: RecordingOptions = {},
  listeners: RecordingListeners = {},
): AudioRecorder => {
  let mediaRecorder: MediaRecorder | null = null;
  let audioChunks: Blob[] = [];
  let stream: MediaStream | null = null;

  /**
   * Initialize the recorder and request microphone permissions
   */
  const initialize = async (): Promise<void> => {
    try {
      stream = await requestMicrophoneAccess();
      mediaRecorder = createMediaRecorder(stream, options);
      setupRecorderEventListeners(mediaRecorder, audioChunks, listeners);
    } catch (error) {
      if (listeners.onError) {
        listeners.onError(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
      throw error;
    }
  };

  /**
   * Start recording audio
   */
  const start = async (timeslice?: number): Promise<void> => {
    if (!mediaRecorder) {
      await initialize();
    }

    if (mediaRecorder?.state === "inactive") {
      mediaRecorder?.start(timeslice);
    }
  };

  /**
   * Stop recording audio
   */
  const stop = (): void => {
    if (mediaRecorder?.state !== "inactive") {
      mediaRecorder?.stop();
    }
  };

  /**
   * Clean up resources used by the recorder
   */
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

  /**
   * Get the current state of the recorder
   */
  const getState = (): "inactive" | "recording" | "paused" | null => {
    return mediaRecorder ? mediaRecorder.state : null;
  };

  return { initialize, start, stop, cleanup, getState };
};

// Step 7: Record for fixed duration functionality
/**
 * Set up a timed recording
 */
const setupTimedRecording = (
  recorder: AudioRecorder,
  maxDuration: number,
): NodeJS.Timeout => {
  return setTimeout(() => {
    recorder.stop();
  }, maxDuration);
};

/**
 * Clean up resources used by timed recording
 */
const cleanupRecordingResources = (
  recorder: AudioRecorder | null,
  timeout: NodeJS.Timeout | null,
): void => {
  if (timeout) {
    clearTimeout(timeout);
  }

  if (recorder) {
    recorder.cleanup();
  }
};

/**
 * Record audio for a specified duration
 * @param options Recording options
 * @param maxDuration Maximum recording duration in milliseconds (default: 60000)
 * @returns Promise that resolves with the recorded audio blob
 */
export const recordAudio = (
  options: RecordingOptions = {},
  maxDuration = 60000,
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    let recorder: AudioRecorder | null = null;
    let recordingTimeout: NodeJS.Timeout | null = null;

    const handleRecordingComplete = (audioBlob: Blob) => {
      cleanupRecordingResources(recorder, recordingTimeout);
      resolve(audioBlob);
    };

    const handleRecordingError = (error: Error) => {
      cleanupRecordingResources(recorder, recordingTimeout);
      reject(error);
    };

    try {
      recorder = createAudioRecorder(options, {
        onStop: handleRecordingComplete,
        onError: handleRecordingError,
      });

      recorder.start();
      recordingTimeout = setupTimedRecording(recorder, maxDuration);
    } catch (error) {
      handleRecordingError(
        error instanceof Error ? error : new Error(String(error)),
      );
    }
  });
};

// Default export for backward compatibility
export default {
  createAudioRecorder,
  recordAudio,
  isAudioRecordingSupported,
};
