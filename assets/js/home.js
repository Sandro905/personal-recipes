import { tr, makeT, detectLang } from './lib/i18n.js';
import { loadIndex, loadUI, el, num, minutes, initTheme } from './lib/data.js';
import { initNav } from './lib/nav.js';
import { initPWA } from './lib/pwa.js';

const lang = detectLang();
const toggleTheme = initTheme();

const state = { query: '', tag: null, sort: 'recent', recipes: [], t: null };

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
      el('div', { class: 'card__media' }, [
        recipe.image
          ? el('img', {
              src: recipe.image, alt: '', loading: 'lazy',
              style: recipe.imageFocus ? `object-position:${recipe.imageFocus}` : null
            })
          : el('span', { class: 'card__initial', 'aria-hidden': 'true', text: title.slice(0, 1) }),
        recipe.method && el('span', { class: 'badge', text: t(`method.${recipe.method}`) })
      ]),
      el('div', { class: 'card__body' }, [
        el('h2', { class: 'card__title', text: title }),
        el('p', { class: 'card__summary', text: tr(recipe.summary, lang) }),
        el('div', { class: 'card__meta' }, [
          el('span', { text: minutes(totalTime(recipe), t) }),
          kcal != null && el('span', {}, [el('strong', { text: num(kcal) }), ` ${t('home.perServing')}`]),
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

  document.getElementById('count').textContent =
    list.length === 1 ? t('site.recipesCountOne') : t('site.recipesCount', { n: list.length });

  if (!list.length) {
    grid.replaceChildren(
      el('li', { class: 'empty' }, [
        el('h2', { text: t('home.empty') }),
        el('p', { text: t('home.emptyHint') })
      ])
    );
    return;
  }
  grid.replaceChildren(...list.map(card));
}

function buildTagRow() {
  const t = state.t;
  const row = document.getElementById('tags');
  const counts = new Map();
  for (const recipe of state.recipes) {
    for (const tag of recipe.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const chip = (tag, label, n) =>
    el('button', {
      class: 'chip',
      type: 'button',
      'aria-pressed': String(state.tag === tag),
      'data-tag': tag ?? 'all',
      onclick: (event) => {
        state.tag = tag;
        for (const btn of row.querySelectorAll('button')) btn.setAttribute('aria-pressed', 'false');
        event.currentTarget.setAttribute('aria-pressed', 'true');
        event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        render();
      }
    }, [
      label,
      n != null && el('span', { class: 'chip__n', text: String(n) })
    ]);

  row.setAttribute('aria-label', t('home.filterByTag'));
  row.replaceChildren(
    chip(null, t('home.allTags'), null),
    ...ordered.map(([tag, n]) => chip(tag, t(`tags.${tag}`), n))
  );
}

function wireControls() {
  const t = state.t;
  document.title = t('site.title');
  document.getElementById('headline').textContent = t('site.title');
  document.getElementById('footnote').textContent = t('site.footnote');

  const input = document.getElementById('q');
  const clear = document.getElementById('clear');
  input.placeholder = t('home.searchPlaceholder');
  input.setAttribute('aria-label', t('home.searchLabel'));
  clear.setAttribute('aria-label', t('home.clear'));

  const syncClear = () => { clear.hidden = input.value === ''; };
  input.addEventListener('input', () => { state.query = input.value; syncClear(); render(); });
  clear.addEventListener('click', () => {
    input.value = ''; state.query = ''; syncClear(); input.focus(); render();
  });
  syncClear();

  const sort = document.getElementById('sort');
  sort.setAttribute('aria-label', t('home.sortLabel'));
  sort.replaceChildren(
    ...['recent', 'name', 'time', 'kcal'].map((key) =>
      el('option', { value: key, text: t(`home.sort.${key}`) })
    )
  );
  sort.addEventListener('change', () => { state.sort = sort.value; render(); });
}

async function main() {
  const [ui, index] = await Promise.all([loadUI(lang), loadIndex()]);
  state.t = makeT(ui, lang);
  state.recipes = index.recipes ?? [];
  initNav({ t: state.t, lang, active: 'home', toggleTheme });
  initPWA({ t: state.t });
  wireControls();
  buildTagRow();
  render();
}

main().catch((error) => {
  console.error(error);
  document.getElementById('grid').replaceChildren(
    el('li', { class: 'empty' }, [
      el('h2', { text: 'Dati non caricati' }),
      el('p', { text: 'Apri il sito da un server locale (npm start) invece che con doppio clic sul file.' })
    ])
  );
});
