/**
 * VaultCalc - i18n public API
 *
 * @see ROADMAP_2K_MONTH.md Task 2.2
 */

export {
  default as i18n,
  initI18n,
  changeLanguage,
  resolveDeviceLanguage,
  SUPPORTED_LANGUAGES,
  RTL_LANGUAGES,
} from './i18n';

export type { LanguageCode } from './i18n';

// Re-export useTranslation for convenient `import { useTranslation } from '@shared/i18n'`
export { useTranslation, Trans } from 'react-i18next';
