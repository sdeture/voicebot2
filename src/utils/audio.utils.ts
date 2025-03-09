/**
 * Audio Utilities
 * --------------
 * Helper functions for audio playback and manipulation.
 */

// Step 1: Play audio feedback sounds
/**
 * Play a beep sound to indicate recording has stopped
 * @param beepFilePath Path to the beep sound file
 */
export const playBeep = (beepFilePath = "/beep.mp3"): void => {
  const beepSound = new Audio(beepFilePath);

  beepSound.play().catch((err) => {
    console.error("Beep playback failed:", err);
  });
};

/**
 * Play a different sound to indicate recording has started
 * @param startBeepFilePath Path to the start beep sound file
 */
export const playStartBeep = (startBeepFilePath = "/start-beep.mp3"): void => {
  const startBeepSound = new Audio(startBeepFilePath);

  startBeepSound.play().catch((err) => {
    console.error("Start beep playback failed:", err);
  });
};

// Step 2: Audio playback utilities
/**
 * Create an Audio element from a base64-encoded audio string
 * @param base64Audio Base64-encoded audio data
 * @param mimeType MIME type of the audio (default: "audio/wav")
 * @returns An Audio element ready for playback
 */
export const createAudioFromBase64 = (
  base64Audio: string,
  mimeType = "audio/wav",
): HTMLAudioElement => {
  const byteCharacters = atob(base64Audio);
  const byteNumbers = new Array(byteCharacters.length);

  // Convert base64 to byte array
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  const audioBlob = new Blob([byteArray], { type: mimeType });
  const audioUrl = URL.createObjectURL(audioBlob);

  return new Audio(audioUrl);
};

/**
 * Play audio with promise-based control
 * @param audio The Audio element to play
 * @returns A promise that resolves when playback ends
 */
export const playAudioWithPromise = (
  audio: HTMLAudioElement,
): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Set up event handlers
    audio.onended = () => {
      // Clean up the object URL if present
      if (audio.src.startsWith("blob:")) {
        URL.revokeObjectURL(audio.src);
      }
      resolve();
    };

    audio.onerror = (event) => {
      if (audio.src.startsWith("blob:")) {
        URL.revokeObjectURL(audio.src);
      }
      reject(
        new Error(`Audio playback error: ${audio.error?.message || "unknown"}`),
      );
    };

    // Start playback
    audio.play().catch(reject);
  });
};

// Default export for backward compatibility
export default {
  playBeep,
  playStartBeep,
  createAudioFromBase64,
  playAudioWithPromise,
};
