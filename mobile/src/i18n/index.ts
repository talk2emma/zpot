import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'react-native-localize';
import type { Language } from '../types/api';
import en from './locales/en.json';
import ptPT from './locales/pt-PT.json';

export const SUPPORTED: Language[] = ['en', 'pt-PT'];

export function deviceLanguage(): Language {
  const tag = getLocales()[0]?.languageCode;
  return tag === 'pt' ? 'pt-PT' : 'en';
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, 'pt-PT': { translation: ptPT } },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnObjects: true,
});

export function applyLanguage(lang: Language) {
  if (i18n.language !== lang) void i18n.changeLanguage(lang);
}

export default i18n;
