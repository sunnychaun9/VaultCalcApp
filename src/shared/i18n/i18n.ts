/**
 * VaultCalc - i18n Configuration (LOCALE-001)
 *
 * Initializes i18next with:
 *   - All 11 supported languages pre-loaded (bundle size is small — ~5KB/lang)
 *   - Device locale detection via expo-localization as fallback
 *   - User override read from settingsStore on init
 *   - English fallback for missing keys
 *   - React Native safe config (no Intl polyfill dependency)
 *
 * Call `initI18n()` once, before the root component renders. It returns a
 * promise so App.tsx can wait on it — but rendering without awaiting is
 * also safe because i18next falls back to the key string while loading.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from './locales/en.json';
import es from './locales/es.json';
import ptBR from './locales/pt-BR.json';
import hi from './locales/hi.json';
import fr from './locales/fr.json';
import de from './locales/de.json';
import tr from './locales/tr.json';
import id from './locales/id.json';
import ru from './locales/ru.json';
import ar from './locales/ar.json';
import vi from './locales/vi.json';

/** Supported language codes. Order matches the UI language picker. */
export const SUPPORTED_LANGUAGES = [
  { code: 'system', nativeName: 'System default', englishName: 'System default' },
  { code: 'en', nativeName: 'English', englishName: 'English' },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish' },
  { code: 'pt-BR', nativeName: 'Português (Brasil)', englishName: 'Portuguese (Brazil)' },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi' },
  { code: 'fr', nativeName: 'Français', englishName: 'French' },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German' },
  { code: 'tr', nativeName: 'Türkçe', englishName: 'Turkish' },
  { code: 'id', nativeName: 'Bahasa Indonesia', englishName: 'Indonesian' },
  { code: 'ru', nativeName: 'Русский', englishName: 'Russian' },
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic' },
  { code: 'vi', nativeName: 'Tiếng Việt', englishName: 'Vietnamese' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

/** Languages that require right-to-left layout. */
export const RTL_LANGUAGES: ReadonlyArray<LanguageCode> = ['ar'];

const resources = {
  en: { translation: en },
  es: { translation: es },
  'pt-BR': { translation: ptBR },
  hi: { translation: hi },
  fr: { translation: fr },
  de: { translation: de },
  tr: { translation: tr },
  id: { translation: id },
  ru: { translation: ru },
  ar: { translation: ar },
  vi: { translation: vi },
} as const;

/**
 * Resolve a device locale (e.g. "pt-BR", "pt_BR", "en-US") to the closest
 * supported language code. Returns 'en' if nothing matches.
 */
export function resolveDeviceLanguage(): Exclude<LanguageCode, 'system'> {
  const locales = Localization.getLocales();
  const primary = locales[0]?.languageTag ?? 'en';
  const normalized = primary.replace('_', '-');

  // Exact match (handles pt-BR)
  if (normalized in resources) return normalized as Exclude<LanguageCode, 'system'>;

  // Language-only match (e.g. "pt-PT" → "pt-BR" since pt-BR is what we ship)
  const langPart = normalized.split('-')[0];
  if (langPart === 'pt') return 'pt-BR';
  if (langPart in resources) return langPart as Exclude<LanguageCode, 'system'>;

  return 'en';
}

/**
 * Initialize i18n. Safe to call multiple times — no-ops after first init.
 *
 * @param preferred - Language code stored in settingsStore. Pass 'system' (or omit)
 *                    to use the device locale.
 */
export async function initI18n(preferred: LanguageCode = 'system'): Promise<void> {
  if (i18n.isInitialized) return;

  const lng = preferred === 'system' ? resolveDeviceLanguage() : preferred;

  await i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: 'en',
    compatibilityJSON: 'v4',
    interpolation: {
      escapeValue: false, // React already escapes
    },
    react: {
      // Disable Suspense — we preload all resources synchronously
      useSuspense: false,
    },
    returnNull: false,
  });
}

/**
 * Change the active language at runtime.
 * Pass 'system' to revert to device locale.
 */
export async function changeLanguage(code: LanguageCode): Promise<void> {
  const effective = code === 'system' ? resolveDeviceLanguage() : code;
  await i18n.changeLanguage(effective);
}

export default i18n;
