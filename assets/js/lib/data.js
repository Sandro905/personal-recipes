// Caricamento dati + utilità condivise dalle due pagine.

const cache = new Map();

async function getJSON(path) {
  if (cache.has(path)) return cache.get(path);
  const promise = fetch(path, { cache: 'no-cache' }).then((res) => {
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    return res.json();
  });
  cache.set(path, promise);
  return promise;
}

export const loadFoods = async () => (await getJSON('data/foods.json')).foods;
export const loadIndex = () => getJSON('data/recipes/index.json');
export const loadUI = (lang) => getJSON(`data/i18n/${lang}.json`);
export const loadRecipe = (slug) => getJSON(`data/recipes/${slug}.json`);

/* ---------- formattazione ---------- */

export function num(value, decimals = 0) {
  if (value == null || Number.isNaN(value)) return '–';
  return new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}

/** 95 → "1 h 35 min", 40 → "40 min" */
export function minutes(total, t) {
  if (!total) return '';
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} ${t('time.min')}`;
  return m ? `${h} ${t('time.h')} ${m} ${t('time.min')}` : `${h} ${t('time.h')}`;
}

export function clock(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ---------- markdown minimo per le note ---------- */

export function inlineMarkdown(text) {
  const escaped = String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
}

/* ---------- DOM ---------- */

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (val == null || val === false) continue;
    if (key === 'class') node.className = val;
    else if (key === 'html') node.innerHTML = val;
    else if (key === 'text') node.textContent = val;
    else if (key.startsWith('on') && typeof val === 'function') node.addEventListener(key.slice(2), val);
    else node.setAttribute(key, val === true ? '' : val);
  }
  for (const child of [].concat(children)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/* ---------- tema ---------- */

export function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem('ricettario:theme'); } catch { /* ignora */ }
  if (saved) document.documentElement.dataset.theme = saved;

  return function toggleTheme() {
    const current =
      document.documentElement.dataset.theme ||
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('ricettario:theme', next); } catch { /* ignora */ }
    return next;
  };
}

/* ---------- storage tollerante ---------- */

export const store = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignora */ }
  }
};
