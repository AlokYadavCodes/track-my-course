/**
 * Keys that represent user preferences, not courses.
 * Used to filter them out when reading all courses from storage.
 */
export const PREFERENCE_KEYS = new Set(["focusMode"]);

/** Current export data format version */
export const EXPORT_VERSION = 1;

/** Default duration value */
export const ZERO_DURATION = { hours: 0, minutes: 0, seconds: 0 } as const;
