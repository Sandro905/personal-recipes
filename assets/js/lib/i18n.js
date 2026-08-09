// Ogni testo leggibile nei dati è un oggetto tipo { it: "...", en: "..." }.
// `tr()` risolve con catena di fallback, così una lingua incompleta non rompe il sito.

export const LANGS = ['it', 'en'];
export const DEFAULT_LANG = 'it';

export function tr(value, lang = DEFAULT_LANG) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value !== 'object') return String(value);
  return value[lang] ?? value[DEFAULT_LANG] ?? Object.values(value)[0] ?? '';
}

/** Dizionario dell'interfaccia: t('macros.protein'), t('recipe.servings', { n: 4 }). */
export function makeT(dict, lang = DEFAULT_LANG) {
  const get = (path) =>
    path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), dict);

  return function t(path, vars) {
    const raw = get(path);
    let out = typeof raw === 'string' ? raw : tr(raw, lang);
    if (!out) return path;
    if (vars) {
      for (const [key, val] of Object.entries(vars)) out = out.replaceAll(`{${key}}`, String(val));
    }
    return out;
  };
}

/** Etichetta di unità con plurale semplice: { one, other } oppure stringa. */
export function unitLabel(dict, unit, qty) {
  const entry = dict?.units?.[unit];
  if (!entry) return unit ?? '';
  if (typeof entry === 'string') return entry;
  return Math.abs(qty) === 1 ? entry.one : entry.other;
}

export function detectLang() {
  const url = new URLSearchParams(location.search).get('lang');
  if (url && LANGS.includes(url)) return url;
  try {
    const saved = localStorage.getItem('ricettario:lang');
    if (saved && LANGS.includes(saved)) return saved;
  } catch { /* storage non disponibile */ }
  const nav = (navigator.language || '').slice(0, 2);
  return LANGS.includes(nav) ? nav : DEFAULT_LANG;
}

export function setLang(lang) {
  try { localStorage.setItem('ricettario:lang', lang); } catch { /* ignora */ }
}
