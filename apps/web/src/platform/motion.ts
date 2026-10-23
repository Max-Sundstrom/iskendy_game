export type MotionPreference = Readonly<{ reducedMotion: boolean }>;

const DEFAULT_PREFERENCE: MotionPreference = { reducedMotion: false };

/** Reads OS and supplied preferences live; future settings can supply a source without a guessed storage key. */
export function createMotionPreference(
  media: Pick<MediaQueryList, 'matches'>,
  supplied: () => MotionPreference = () => DEFAULT_PREFERENCE,
): () => boolean {
  return () => media.matches || supplied().reducedMotion;
}
