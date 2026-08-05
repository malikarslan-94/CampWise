/**
 * Locale normalisation.
 *
 * Each YooWifi surface uses its own vocabulary for the same languages — the web app
 * says `vi`, the mobile app says `vn`; `ko`/`kr`, `ms`/`ml`, `zhcn`/`zh-CNS`. That is
 * an input-normalisation problem, not something to model per tenant: whatever code
 * arrives, we normalise it once here, then map to what the dispatcher expects.
 *
 * Locale is the one caller-supplied field that is safe to trust. `tenantId` and
 * `userId` are permissions — they decide what data is reachable, so they may never
 * come from the client. Locale is a preference: the worst a caller achieves by lying
 * is an answer in a language they asked for.
 */

/** Internal canonical codes. ISO 639-1, with BCP-47 script subtags for Chinese. */
export const SUPPORTED_LOCALES = [
  'en',
  'ms',
  'id',
  'th',
  'vi',
  'ja',
  'ko',
  'zh-Hans',
  'zh-Hant',
  'es',
  'fr',
  'de',
  'tl',
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Every code any surface is known to send, mapped to its canonical form.
 * Keys are lower-cased; lookup lower-cases the input first.
 *
 * Where two surfaces disagree, both aliases are listed — several of the client
 * codes are not valid ISO 639-1 at all (`ml` is Malayalam, not Malay; `gm` is
 * Gambia, not German), which is why normalising to a real standard matters.
 */
const ALIASES: Record<string, SupportedLocale> = {
  en: 'en',
  'en-us': 'en',
  'en-gb': 'en',

  ms: 'ms',
  ml: 'ms', // mobile app's code for Malay
  'ms-my': 'ms',

  id: 'id',
  'id-id': 'id',

  th: 'th',
  vi: 'vi',
  vn: 'vi', // mobile app's code for Vietnamese

  ja: 'ja',
  jp: 'ja', // web app's code for Japanese

  ko: 'ko',
  kr: 'ko', // mobile app's code for Korean

  'zh-hans': 'zh-Hans',
  zhcn: 'zh-Hans', // web
  'zh-cns': 'zh-Hans', // mobile
  'zh-cn': 'zh-Hans',
  zh: 'zh-Hans',

  'zh-hant': 'zh-Hant',
  zhhk: 'zh-Hant', // web
  'zh-cht': 'zh-Hant', // mobile
  'zh-tw': 'zh-Hant',
  'zh-hk': 'zh-Hant',

  es: 'es',
  fr: 'fr',

  de: 'de',
  gm: 'de', // web app's code for German

  tl: 'tl',
  ph: 'tl', // web app's code for Tagalog
};

/**
 * Canonical locale → the code sent upstream in the dispatcher envelope.
 *
 * Defaults to the web surface's wire format, since that surface is live in
 * production and therefore known to be accepted. A tenant whose upstream wants
 * something different can override per code via `localeRule.remap`.
 *
 * OPEN QUESTION: the full list the dispatcher accepts is unconfirmed — see
 * docs/end-to-end-flow.md §13, question 3. Japanese is the only entry verified
 * against both surfaces (web remaps `jp`→`JA`; mobile sends `JA` natively).
 */
const UPSTREAM_LANGUAGE: Record<SupportedLocale, string> = {
  en: 'EN',
  ms: 'MS',
  id: 'ID',
  th: 'TH',
  vi: 'VI',
  ja: 'JA',
  ko: 'KO',
  'zh-Hans': 'ZHCN',
  'zh-Hant': 'ZHHK',
  es: 'ES',
  fr: 'FR',
  de: 'GM',
  tl: 'PH',
};

/**
 * Normalises any surface's locale code to a canonical one.
 * Returns undefined for anything unrecognised — callers fall back to the tenant
 * default rather than guessing.
 */
export function normalizeLocale(input?: string | null): SupportedLocale | undefined {
  if (!input) return undefined;

  const cleaned = input.trim().toLowerCase().replace(/_/g, '-');
  if (!cleaned) return undefined;

  const direct = ALIASES[cleaned];
  if (direct) return direct;

  // `ms-MY`, `fr-CA` → try the base language on its own.
  const base = cleaned.split('-')[0];
  return ALIASES[base];
}

/** Maps a canonical locale to the language code the dispatcher expects. */
export function toUpstreamLanguage(locale: SupportedLocale): string {
  return UPSTREAM_LANGUAGE[locale];
}

/** Human-readable name, for the reply-language instruction in the system prompt. */
const DISPLAY_NAMES: Record<SupportedLocale, string> = {
  en: 'English',
  ms: 'Malay',
  id: 'Indonesian',
  th: 'Thai',
  vi: 'Vietnamese',
  ja: 'Japanese',
  ko: 'Korean',
  'zh-Hans': 'Simplified Chinese',
  'zh-Hant': 'Traditional Chinese',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  tl: 'Tagalog',
};

export function localeDisplayName(locale: SupportedLocale): string {
  return DISPLAY_NAMES[locale];
}
