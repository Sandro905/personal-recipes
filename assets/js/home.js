import { LANGS, tr, makeT, detectLang, setLang } from './lib/i18n.js';
import { loadIndex, loadUI, el, num, minutes, initTheme } from './lib/data.js';

const lang = detectLang();
const toggleTheme = initTheme();

const state = { query: '', tag: null, sort: 'recent', recipes: [], t: null };

const TINTS = ['--saffron', '--basil', '--wine', '--ink'];
function tintFor(slug) {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return `color-mix(in srgb, var(${TINTS[h % TINTS.length]}) 16%, var(--card))`;
}

function totalTime(recipe) {
  const { prep = 0, rest = 0, cook = 0 } = recipe.time ?? {};
  return prep + rest + cook;
}

function matches(recipe) {
  if (state.tag && !(recipe.tags ?? []).includes(state.tag)) return false;
  if (!state.query) return true;
  const needle = state.query.toLowerCase().trim();
  const haystack = [
    tr(recipe.title, lang),
    tr(recipe.summary, lang),
    tr(recipe.search, lang),
    (recipe.tags ?? []).map((tag) => state.t(`tags.${tag}`)).join(' '),
    state.t(`method.${recipe.method}`)
  ].join(' ').toLowerCase();
  return needle.split(/\s+/).every((word) => haystack.includes(word));
}

function sortRecipes(list) {
  const by = {
    recent: (a, b) => String(b.added ?? '').localeCompare(String(a.added ?? '')),
    name: (a, b) => tr(a.title, lang).localeCompare(tr(b.title, lang), 'it'),
    time: (a, b) => totalTime(a) - totalTime(b),
    kcal: (a, b) => (a.kcalPerServing ?? Infinity) - (b.kcalPerServing ?? Infinity)
  };
  return [...list].sort(by[state.sort] ?? by.recent);
}

function card(recipe) {
  const t = state.t;
  const kcal = recipe.kcalPerServing;
  const title = tr(recipe.title, lang);

  return el('li', { class: 'card' }, [
    el('a', { href: `ricetta.html?r=${encodeURIComponent(recipe.slug)}&lang=${lang}` }, [
      el('div', { class: 'card__plate', style: `--tint:${tintFor(recipe.slug)}`, 'aria-hidden': 'true' }, [
        recipe.image
          ? el('img', {
              src: recipe.image, alt: '', loading: 'lazy',
              style: recipe.imageFocus ? `object-position:${recipe.imageFocus}` : null
            })
          : el('span', { class: 'card__initial', text: title.slice(0, 1) }),
        recipe.method && el('span', { class: 'card__method', text: t(`method.${recipe.method}`) })
      ]),
      el('div', { class: 'card__body' }, [
        el('h2', { class: 'card__title', text: title }),
        el('p', { class: 'card__summary', text: tr(recipe.summary, lang) }),
        el('div', { class: 'card__meta' }, [
          el('span', {}, [el('b', { text: minutes(totalTime(recipe), t) })]),
          kcal != null && el('span', {}, [el('b', { text: num(kcal) }), ` ${t('home.perServing')}`]),
          el('span', { text: t(`difficulty.${recipe.difficulty}`) })
        ])
      ])
    ])
  ]);
}

function render() {
  const t = state.t;
  const list = sortRecipes(state.recipes.filter(matches));
  const grid = document.getElementById('grid');
  grid.replaceChildren();

  document.getElementById('count').textContent =
    list.length === 1 ? t('site.recipesCountOne') : t('site.recipesCount', { n: list.length });

  if (!list.length) {
    grid.append(
      el('li', { class: 'empty', style: 'grid-column:1/-1' }, [
        el('h2', { text: t('home.empty') }),
        el('p', { text: t('home.emptyHint') })
      ])
    );
    return;
  }
  for (const recipe of list) grid.append(card(recipe));
}

function buildTagRow() {
  const t = state.t;
  const row = document.getElementById('tags');
  const counts = new Map();
  for (const recipe of state.recipes) {
    for (const tag of recipe.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const makeBtn = (tag, label) =>
    el('button', {
      class: 'pill',
      type: 'button',
      'aria-pressed': String(state.tag === tag),
      onclick: () => {
        state.tag = tag;
        for (const btn of row.querySelectorAll('button')) btn.setAttribute('aria-pressed', 'false');
        row.querySelector(`[data-tag="${tag ?? 'all'}"]`)?.setAttribute('aria-pressed', 'true');
        render();
      },
      'data-tag': tag ?? 'all',
      text: label
    });

  row.replaceChildren(
    makeBtn(null, t('home.allTags')),
    ...ordered.map(([tag, n]) => makeBtn(tag, `${t(`tags.${tag}`)} ${n}`))
  );
}

function wireChrome() {
  const t = state.t;
  document.documentElement.lang = lang;
  document.title = `${t('site.title')}`;
  document.getElementById('brandName').textContent = t('site.title');
  document.getElementById('headline').textContent = t('site.title');
  document.getElementById('tagline').textContent = t('site.tagline');

  const input = document.getElementById('q');
  input.placeholder = t('home.searchPlaceholder');
  input.setAttribute('aria-label', t('home.searchLabel'));
  input.addEventListener('input', () => { state.query = input.value; render(); });

  const clear = document.getElementById('clear');
  clear.title = t('home.clear');
  clear.addEventListener('click', () => { input.value = ''; state.query = ''; input.focus(); render(); });

  const sort = document.getElementById('sort');
  sort.setAttribute('aria-label', t('home.sortLabel'));
  sort.replaceChildren(
    ...['recent', 'name', 'time', 'kcal'].map((key) =>
      el('option', { value: key, text: t(`home.sort.${key}`) })
    )
  );
  sort.addEventListener('change', () => { state.sort = sort.value; render(); });

  const theme = document.getElementById('theme');
  theme.title = t('nav.theme');
  theme.addEventListener('click', () => toggleTheme());

  const langs = document.getElementById('langs');
  langs.setAttribute('aria-label', t('nav.lang'));
  langs.replaceChildren(
    ...LANGS.map((code) =>
      el('button', {
        type: 'button',
        text: code,
        'aria-pressed': String(code === lang),
        onclick: () => { setLang(code); location.search = `?lang=${code}`; }
      })
    )
  );
}

async function main() {
  const [ui, index] = await Promise.all([loadUI(lang), loadIndex()]);
  state.t = makeT(ui, lang);
  state.recipes = index.recipes ?? [];
  wireChrome();
  buildTagRow();
  render();
}

main().catch((error) => {
  console.error(error);
  document.getElementById('grid').replaceChildren(
    el('li', { class: 'empty', style: 'grid-column:1/-1' }, [
      el('h2', { text: 'Dati non caricati' }),
      el('p', { text: 'Apri il sito da un server locale (npm start) invece che con doppio clic sul file.' })
    ])
  );
});
