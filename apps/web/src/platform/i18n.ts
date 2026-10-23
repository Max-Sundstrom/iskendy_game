import en from '@kometa/content/i18n/en.json';
import ru from '@kometa/content/i18n/ru.json';

// Player-facing strings live in packages/content/i18n (AGENTS §7). Russian first: v1 ships inside Iskendi, so the
// game speaks Russian unless told otherwise (host.init locale in P5-09, or ?lang=en for checks).

export type Strings = typeof ru;

/** Picks the dictionary for a BCP 47 tag; anything that isn't English gets Russian. */
export function stringsFor(lang: string): Strings {
  return lang.toLowerCase().startsWith('en') ? en : ru;
}
