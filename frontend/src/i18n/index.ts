// template-managed (bootstrap): do not edit; strings live in the locale
// catalogs. Delete this line to take ownership.
// i18n is first-class: every user-facing string goes through t(), even while
// English is the only shipped language. Number and date formatting use native
// Intl / date-fns, not the i18n library.
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en } },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
