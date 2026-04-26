/**
 * Tactical Haptic Feedback Engine
 * Provides distinct vibration patterns for different brewing phases.
 */

export const HAPTIC_PATTERNS = {
  // Mission Start: Double strong pulse
  MISSION_IGNITION: [200, 100, 200],
  
  // Countdown: Short alert every second (pulse)
  PRE_STAGE_ALERT: [50],
  
  // Start Pouring: Long solid pulse
  INJECTION_GO: [500],
  
  // Stop Pouring / Transition: Rapid double cut
  CUT_OFF_SIGNAL: [100, 50, 100],
  
  // Mission Complete: Progressive rhythmic success
  MISSION_ACCOMPLISHED: [300, 100, 300, 100, 500],
  
  // Warning/Abort: High frequency rapid pulses
  ABORT_WARNING: [50, 50, 50, 50, 50, 50]
};

export const triggerHaptic = (pattern: number | number[]) => {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.warn("Haptic feedback failed", e);
    }
  }
};
