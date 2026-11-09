import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'react-native-localize';
import type { Language } from '../types/api';
import en from './locales/en.json';
import enP2 from './locales/en.part2.json';
import ptPT from './locales/pt-PT.json';
import ptP2 from './locales/pt-PT.part2.json';

export const SUPPORTED: Language[] = ['en', 'pt-PT'];

export function deviceLanguage(): Language {
  const tag = getLocales()[0]?.languageCode;
  return tag === 'pt' ? 'pt-PT' : 'en';
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: { ...en, ...enP2 } }, 'pt-PT': { translation: { ...ptPT, ...ptP2 } } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnObjects: true,
});

export function applyLanguage(lang: Language) {
  if (i18n.language !== lang) void i18n.changeLanguage(lang);
}

export default i18n;
