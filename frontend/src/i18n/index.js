import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en/translation.json';
import ta from './locales/ta/translation.json';

const savedLang = localStorage.getItem('pos_language') || 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ta: { translation: ta },
  },
  lng: savedLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export function changeLanguage(lang) {
  localStorage.setItem('pos_language', lang);
  i18n.changeLanguage(lang);
}

export default i18n;
