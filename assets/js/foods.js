import { tr, makeT, detectLang } from './lib/i18n.js';
import { loadFoods, loadUI, el, num, initTheme } from './lib/data.js';
import { energySplit } from './lib/nutrition.js';
import { initNav } from './lib/nav.js';

const lang = detectLang();
const toggleTheme = initTheme();

const state = { query: '', category: null, sort: 'name', foods: [], t: null };

function matches(food) {
  const t = state.t;
  if (state.category && food.category !== state.category) return false;
  if (!state.query) return true;
  const needle = state.query.toLowerCase().trim();
  const haystack = [tr(food.name, lang), t(`foodCategory.${food.category}`)].join(' ').toLowerCase();
  return needle.split(/\s+/).every((word) => haystack.includes(word));
}

function sortFoods(list) {
  const by = {
    name: (a, b) => tr(a.name, lang).localeCompare(tr(b.name, lang), 'it'),
    kcal: (a, b) => (b.per100g?.kcal ?? 0) - (a.per100g?.kcal ?? 0),
    protein: (a, b) => (b.per100g?.protein ?? 0) - (a.per100g?.protein ?? 0),
    carbs: (a, b) => (b.per100g?.carbs ?? 0) - (a.per100g?.carbs ?? 0),
    fat: (a, b) => (b.per100g?.fat ?? 0) - (a.per100g?.fat ?? 0)
  };
  return [...list].sort(by[state.sort] ?? by.name);
}

function macroRow(t, key, dot, sub, value) {
  return el('li', { class: sub ? 'sub' : '' }, [
    dot && el('span', { class: `dot is-${dot}` }),
    el('span', { text: t(`macros.${key}`) }),
    el('span', { class: 'n', text: `${num(value, value < 10 ? 1 : 0)} g` })
  ]);
}

function foodCard(food) {
  const t = state.t;
  const per100g = food.per100g ?? {};
  const split = energySplit(per100g);

  return el('li', { class: 'food-card' }, [
    el('span', { class: 'label', text: t(`foodCategory.${food.category}`) }),
    el('h2', { class: 'food-card__name', text: tr(food.name, lang) }),
    el('div', { class: 'kcal' }, [
      el('b', { text: num(per100g.kcal ?? 0) }),
      el('span', { text: `kcal · ${t('foods.per100g')}` })
    ]),
    el('div', {
      class: 'macrobar', role: 'img',
      'aria-label': `${t('macros.split')}: ${t('macros.protein')} ${Math.round(split.protein)}%, ${t('macros.carbs')} ${Math.round(split.carbs)}%, ${t('macros.fat')} ${Math.round(split.fat)}%`
    }, [
      el('span', { class: 'is-protein', style: `width:${split.protein}%` }),
      el('span', { class: 'is-carbs', style: `width:${split.carbs}%` }),
      el('span', { class: 'is-fat', style: `width:${split.fat}%` })
    ]),
    el('ul', { class: 'macrolist' }, [
      macroRow(t, 'protein', 'protein', false, per100g.protein ?? 0),
      macroRow(t, 'carbs', 'carbs', false, per100g.carbs ?? 0),
      macroRow(t, 'sugars', null, true, per100g.sugars ?? 0),
      macroRow(t, 'fat', 'fat', false, per100g.fat ?? 0),
      macroRow(t, 'fiber', null, false, per100g.fiber ?? 0),
      macroRow(t, 'salt', null, false, per100g.salt ?? 0)
    ])
  ]);
}

function render() {
  const t = state.t;
  const list = sortFoods(state.foods.filter(matches));
  const grid = document.getElementById('foodgrid');

  document.getElementById('count').textContent =
    list.length === 1 ? t('foods.countOne') : t('foods.count', { n: list.length });

  if (!list.length) {
    grid.replaceChildren(
      el('li', { class: 'empty' }, [
        el('h2', { text: t('foods.empty') }),
        el('p', { text: t('foods.emptyHint') })
      ])
    );
    return;
  }
  grid.replaceChildren(...list.map(foodCard));
}

function buildCategoryRow() {
  const t = state.t;
  const row = document.getElementById('cats');
  const counts = new Map();
  for (const food of state.foods) counts.set(food.category, (counts.get(food.category) ?? 0) + 1);
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  const chip = (cat, label, n) =>
    el('button', {
      class: 'chip',
      type: 'button',
      'aria-pressed': String(state.category === cat),
      'data-cat': cat ?? 'all',
      onclick: (event) => {
        state.category = cat;
        for (const btn of row.querySelectorAll('button')) btn.setAttribute('aria-pressed', 'false');
        event.currentTarget.setAttribute('aria-pressed', 'true');
        event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        render();
      }
    }, [
      label,
      n != null && el('span', { class: 'chip__n', text: String(n) })
    ]);

  row.setAttribute('aria-label', t('foods.filterByCategory'));
  row.replaceChildren(
    chip(null, t('foods.allCategories'), null),
    ...ordered.map(([cat, n]) => chip(cat, t(`foodCategory.${cat}`), n))
  );
}

function wireControls() {
  const t = state.t;
  document.title = `${t('foods.title')} — ${t('site.title')}`;
  document.getElementById('eyebrow').textContent = t('foods.eyebrow');
  document.getElementById('headline').textContent = t('foods.title');
  document.getElementById('tagline').textContent = t('foods.tagline');
  document.getElementById('footnote').textContent = t('foods.footnote');

  const input = document.getElementById('q');
  const clear = document.getElementById('clear');
  input.placeholder = t('foods.searchPlaceholder');
  input.setAttribute('aria-label', t('foods.searchLabel'));
  clear.setAttribute('aria-label', t('foods.clear'));

  const syncClear = () => { clear.hidden = input.value === ''; };
  input.addEventListener('input', () => { state.query = input.value; syncClear(); render(); });
  clear.addEventListener('click', () => {
    input.value = ''; state.query = ''; syncClear(); input.focus(); render();
  });
  syncClear();

  const sort = document.getElementById('sort');
  sort.setAttribute('aria-label', t('foods.sortLabel'));
  sort.replaceChildren(
    ...['name', 'kcal', 'protein', 'carbs', 'fat'].map((key) =>
      el('option', { value: key, text: t(`foods.sort.${key}`) })
    )
  );
  sort.addEventListener('change', () => { state.sort = sort.value; render(); });
}

async function main() {
  const [ui, foods] = await Promise.all([loadUI(lang), loadFoods()]);
  state.t = makeT(ui, lang);
  state.foods = Object.entries(foods).map(([id, food]) => ({ id, ...food }));
  initNav({ t: state.t, lang, active: 'foods', toggleTheme });
  wireControls();
  buildCategoryRow();
  render();
}

main().catch((error) => {
  console.error(error);
  document.getElementById('foodgrid').replaceChildren(
    el('li', { class: 'empty' }, [
      el('h2', { text: 'Dati non caricati' }),
      el('p', { text: 'Apri il sito da un server locale (npm start) invece che con doppio clic sul file.' })
    ])
  );
});
