/**
 * Audio utility functions for the voice chat interface
 */

/**
 * Plays a beep sound to indicate recording has stopped
 * @param beepFilePath Path to the beep sound file
 */
export const playBeep = (beepFilePath = "/beep.mp3") => {
  const beepSound = new Audio(beepFilePath);
  beepSound.play().catch((err) => {
    console.error("Beep playback failed:", err);
  });
};

/**
 * Plays a different sound to indicate recording has started
 * @param startBeepFilePath Path to the start beep sound file
 */
export const playStartBeep = (startBeepFilePath = "/start-beep.mp3") => {
  const startBeepSound = new Audio(startBeepFilePath);
  startBeepSound.play().catch((err) => {
    console.error("Start beep playback failed:", err);
  });
};

export default {
  playBeep,
  playStartBeep,
};
