import type { Duration } from "./types.js";

/**
 * Parses a duration string in "MM:SS" or "HH:MM:SS" format into total seconds.
 *
 * @example
 * hmsToSeconds("1:30")    // 90
 * hmsToSeconds("1:02:30") // 3750
 */
export function hmsToSeconds(durationString: string): number {
  const parts = durationString.trim().split(":").map(Number);
  if (parts.length === 3) {
    return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  }
  if (parts.length === 2) {
    return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  }
  return 0;
}

/**
 * Converts a {@link Duration} object to total seconds.
 */
export function durationToSeconds(duration: Duration | undefined | null): number {
  if (!duration) return 0;
  return (duration.hours || 0) * 3600 + (duration.minutes || 0) * 60 + (duration.seconds || 0);
}

/**
 * Converts total seconds to a {@link Duration} object.
 */
export function secondsToDuration(totalSeconds: number): Duration {
  const seconds = Math.max(0, Math.round(totalSeconds));
  return {
    hours: Math.floor(seconds / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}

/**
 * Adds a duration string (e.g. "5:30") to an existing {@link Duration} and returns the result.
 * Does not mutate the input.
 */
export function addDuration(base: Duration, durationString: string): Duration {
  const baseSeconds = durationToSeconds(base);
  const addSeconds = hmsToSeconds(durationString);
  return secondsToDuration(baseSeconds + addSeconds);
}

/**
 * Subtracts seconds from a {@link Duration}. Result is clamped to 0.
 * Does not mutate the input.
 */
export function subtractSeconds(base: Duration, secondsToRemove: number): Duration {
  const baseSeconds = durationToSeconds(base);
  return secondsToDuration(Math.max(0, baseSeconds - secondsToRemove));
}

/**
 * Formats a {@link Duration} as "Xh Ym Zs".
 */
export function formatDuration(duration: Duration): string {
  return `${duration.hours}h ${duration.minutes}m ${duration.seconds}s`;
}

/**
 * Formats a {@link Duration} as "Xh Ym" (no seconds; used for invested time).
 */
export function formatDurationShort(duration: Duration): string {
  return `${duration.hours}h ${duration.minutes}m`;
}
