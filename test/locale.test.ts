import { describe, it, expect } from 'vitest';
import { normalizeLocale, toUpstreamLanguage, localeDisplayName } from '../src/lib/locale.js';

/**
 * The surfaces disagree on locale codes for the same languages. Discovery found six
 * mismatches between the web and mobile apps; several of the client codes are not
 * valid ISO 639-1 at all. Normalisation happens once, at our boundary.
 */
describe('normalizeLocale', () => {
  it('accepts the codes both surfaces use for the same language', () => {
    // web / mobile
    expect(normalizeLocale('vi')).toBe('vi');
    expect(normalizeLocale('vn')).toBe('vi');

    expect(normalizeLocale('jp')).toBe('ja');
    expect(normalizeLocale('ja')).toBe('ja');

    expect(normalizeLocale('ko')).toBe('ko');
    expect(normalizeLocale('kr')).toBe('ko');

    expect(normalizeLocale('ms')).toBe('ms');
    expect(normalizeLocale('ml')).toBe('ms'); // mobile's code for Malay

    expect(normalizeLocale('zhcn')).toBe('zh-Hans');
    expect(normalizeLocale('zh-CNS')).toBe('zh-Hans');

    expect(normalizeLocale('zhhk')).toBe('zh-Hant');
    expect(normalizeLocale('zh-CHT')).toBe('zh-Hant');

    expect(normalizeLocale('gm')).toBe('de'); // web's code for German
    expect(normalizeLocale('ph')).toBe('tl'); // web's code for Tagalog
  });

  it('is case- and separator-insensitive', () => {
    expect(normalizeLocale('EN')).toBe('en');
    expect(normalizeLocale('  Ja  ')).toBe('ja');
    expect(normalizeLocale('zh_CNS')).toBe('zh-Hans');
  });

  it('falls back to the base language for region-tagged input', () => {
    expect(normalizeLocale('ms-MY')).toBe('ms');
    expect(normalizeLocale('fr-CA')).toBe('fr');
    expect(normalizeLocale('en-GB')).toBe('en');
  });

  it('returns undefined for anything unrecognised, rather than guessing', () => {
    expect(normalizeLocale('klingon')).toBeUndefined();
    expect(normalizeLocale('')).toBeUndefined();
    expect(normalizeLocale(undefined)).toBeUndefined();
    expect(normalizeLocale(null)).toBeUndefined();
  });
});

describe('toUpstreamLanguage', () => {
  it('maps Japanese to JA — the one code verified against both live surfaces', () => {
    expect(toUpstreamLanguage('ja')).toBe('JA');
  });

  it('maps every supported locale to an uppercase code', () => {
    for (const locale of ['en', 'ms', 'vi', 'zh-Hans', 'zh-Hant', 'tl'] as const) {
      expect(toUpstreamLanguage(locale)).toMatch(/^[A-Z-]+$/);
    }
  });

  it('collapses both client spellings onto one upstream code', () => {
    const fromWeb = toUpstreamLanguage(normalizeLocale('vi')!);
    const fromMobile = toUpstreamLanguage(normalizeLocale('vn')!);
    expect(fromWeb).toBe(fromMobile);
  });
});

describe('localeDisplayName', () => {
  it('gives a human name for the system prompt', () => {
    expect(localeDisplayName('ms')).toBe('Malay');
    expect(localeDisplayName('zh-Hant')).toBe('Traditional Chinese');
  });
});
