import { strings } from './strings.js?v=7';
import { actionStrings, apiErrorKeys } from './action-strings.js?v=5';

const locales = { ru: 'ru-RU', en: 'en-GB', cs: 'cs-CZ' };
const picker = document.querySelector('#language');
const storageKey = 'suzy.language';
let language = 'ru';

try {
  const saved = localStorage.getItem(storageKey);
  if (Object.hasOwn(locales, saved)) language = saved;
} catch { /* Keep the default when browser storage is unavailable. */ }

export function getLanguage() {
  return language;
}

export function localeFor(code = language) {
  return locales[code] ?? locales.ru;
}

export function translate(key) {
  return strings[language][key] ?? actionStrings[language][key] ?? strings.ru[key] ?? actionStrings.ru[key] ?? key;
}

export function translateApiError(message) {
  const key = Object.hasOwn(apiErrorKeys, message) ? apiErrorKeys[message] : 'action.error.request';
  return translate(key);
}

function renderLanguage() {
  document.documentElement.lang = language;
  picker.value = language;
  for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = translate(node.dataset.i18n);
  for (const [suffix, attribute] of [['label', 'aria-label'], ['alt', 'alt'], ['content', 'content']]) {
    const keyAttribute = `data-i18n-${suffix}`;
    for (const node of document.querySelectorAll(`[${keyAttribute}]`)) {
      node.setAttribute(attribute, translate(node.getAttribute(keyAttribute)));
    }
  }
}

renderLanguage();
picker.addEventListener('change', () => {
  if (!Object.hasOwn(locales, picker.value) || picker.value === language) return;
  language = picker.value;
  try { localStorage.setItem(storageKey, language); } catch { /* Language still applies in this tab. */ }
  renderLanguage();
  document.dispatchEvent(new CustomEvent('suzy:language', { detail: language }));
});
