import { tr, makeT, unitLabel, detectLang } from './lib/i18n.js';
import { loadFoods, loadRecipe, loadUI, el, num, minutes, clock, inlineMarkdown, initTheme, store } from './lib/data.js';
import { computeNutrition, energySplit, flatIngredients } from './lib/nutrition.js';
import { toGrams, roundQty } from './lib/units.js';
import { initNav, icons } from './lib/nav.js';

const lang = detectLang();
const toggleTheme = initTheme();
const slug = new URLSearchParams(location.search).get('r');

const state = { recipe: null, foods: null, t: null, ui: null, servings: 1, base: 1, view: 'serving' };

/* ---------- quantità ---------- */

function ingredientName(item) {
  if (item.label) return tr(item.label, lang);
  return tr(state.foods[item.food]?.name, lang) || item.food;
}

function qtyText(item, scale) {
  const t = state.t;
  if (item.unit === 'qb' || item.qty == null) return unitLabel(state.ui, 'qb', 0) || t('units.qb');
  const value = roundQty(item.qty * scale, item.unit);
  const unit = unitLabel(state.ui, item.unit ?? 'pz', value);
  return item.unit && item.unit !== 'pz' ? `${num(value, value % 1 ? 1 : 0)} ${unit}` : `${num(value, value % 1 ? 2 : 0)} ${unit}`;
}

/** Testo usato dentro i passaggi: "440 g di farina 0" oppure "2 uova". */
function inlineQty(item, scale) {
  const name = ingredientName(item);
  if (item.unit === 'qb' || item.qty == null) return `${name} ${state.t('units.qb')}`;
  const value = roundQty(item.qty * scale, item.unit);
  const shown = num(value, value % 1 ? (item.unit ? 1 : 2) : 0);
  if (!item.unit || item.unit === 'pz') return `${shown} ${name}`;
  const unit = unitLabel(state.ui, item.unit, value);
  const tpl = state.ui?.format?.qtyOf ?? '{qty} {unit} di {name}';
  return tpl.replace('{qty}', shown).replace('{unit}', unit).replace('{name}', name);
}

function gramsHint(item, scale) {
  const food = state.foods[item.food];
  const { grams, exact } = toGrams(item, food);
  if (grams == null) return null;
  if (item.unit === 'g' || item.unit === 'kg') return null;
  return `≈ ${num(grams * scale)} g${exact ? '' : ' (stima)'}`;
}

/* ---------- ingredienti ---------- */

function checkedKey() { return `ricettario:checked:${slug}`; }

function renderIngredients() {
  const t = state.t;
  const scale = state.servings / state.base;
  const host = document.getElementById('ledger');
  const checked = new Set(store.get(checkedKey(), []));
  host.replaceChildren();

  let index = 0;
  for (const section of state.recipe.ingredients ?? []) {
    if (section.section) {
      host.append(el('li', { class: 'label ledger__section', text: tr(section.section, lang) }));
    }
    for (const item of section.items ?? []) {
      const id = `ing-${index++}`;
      const hint = gramsHint(item, scale);
      const known = Boolean(state.foods[item.food]);
      host.append(
        el('li', {}, [
          el('div', { class: 'ing' }, [
            el('input', {
              type: 'checkbox', id, checked: checked.has(id),
              onchange: (event) => {
                const next = new Set(store.get(checkedKey(), []));
                event.target.checked ? next.add(id) : next.delete(id);
                store.set(checkedKey(), [...next]);
              }
            }),
            el('label', { for: id }, [
              el('span', { class: 'ing__name', text: ingredientName(item) }),
              el('span', {
                class: `ing__qty${known ? '' : ' is-estimate'}`,
                title: hint ?? '',
                text: qtyText(item, scale)
              })
            ])
          ]),
          item.note && el('span', { class: 'ing__note', text: tr(item.note, lang) })
        ])
      );
    }
  }

  document.getElementById('scaledNote').textContent =
    t('recipe.scaled', { n: `${state.servings} ${tr(state.recipe.yield?.label, lang)}` });
}

/* ---------- macro ---------- */

function renderMacros() {
  const t = state.t;
  const scale = state.servings / state.base;
  const result = computeNutrition(state.recipe, state.foods, { scale });
  const macros = state.view === 'serving' ? result.perServing : result.totals;
  const split = energySplit(macros);

  document.getElementById('kcalValue').textContent = num(macros.kcal);
  document.getElementById('kcalUnit').textContent =
    state.view === 'serving' ? `kcal · ${t('macros.perServing').toLowerCase()}` : `kcal · ${t('macros.total').toLowerCase()}`;

  const bar = document.getElementById('macrobar');
  bar.replaceChildren(
    el('span', { class: 'is-protein', style: `width:${split.protein}%` }),
    el('span', { class: 'is-carbs', style: `width:${split.carbs}%` }),
    el('span', { class: 'is-fat', style: `width:${split.fat}%` })
  );
  bar.setAttribute('role', 'img');
  bar.setAttribute('aria-label',
    `${t('macros.split')}: ${t('macros.protein')} ${Math.round(split.protein)}%, ${t('macros.carbs')} ${Math.round(split.carbs)}%, ${t('macros.fat')} ${Math.round(split.fat)}%`);

  const rows = [
    ['protein', 'protein', false],
    ['carbs', 'carbs', false],
    ['sugars', null, true],
    ['fat', 'fat', false],
    ['fiber', null, false],
    ['salt', null, false]
  ];
  document.getElementById('macrolist').replaceChildren(
    ...rows.map(([key, dot, sub]) =>
      el('li', { class: sub ? 'sub' : '' }, [
        dot && el('span', { class: `dot is-${dot}` }),
        el('span', { text: t(`macros.${key}`) }),
        el('span', { class: 'n', text: `${num(macros[key], macros[key] < 10 ? 1 : 0)} g` })
      ])
    )
  );

  const issues = document.getElementById('issues');
  const unique = [...new Map(result.warnings.map((w) => [`${w.food}:${w.issue}`, w])).values()];
  if (!unique.length) { issues.hidden = true; return; }
  issues.hidden = false;
  issues.querySelector('summary').textContent = `${t('macros.issuesTitle')} (${unique.length})`;
  issues.querySelector('ul').replaceChildren(
    ...unique.map((w) =>
      el('li', {
        text: t(`macros.issues.${w.issue}`, { food: tr(state.foods[w.food]?.name, lang) || w.food })
      })
    )
  );
}

/* ---------- passaggi ---------- */

function stepHTML(text, scale) {
  const items = flatIngredients(state.recipe);
  const escaped = inlineMarkdown(text);
  return escaped.replace(/\{\{([a-z0-9-]+)(?:#(\d+))?\}\}/gi, (match, food, nth) => {
    const occurrences = items.filter((item) => item.food === food);
    const item = occurrences[(Number(nth) || 1) - 1];
    if (!item) return match;
    return `<span class="q">${inlineQty(item, scale)}</span>`;
  });
}

function renderSteps() {
  const t = state.t;
  const scale = state.servings / state.base;
  const host = document.getElementById('steps');
  host.replaceChildren();

  (state.recipe.steps ?? []).forEach((step, i) => {
    const li = el('li', {}, [
      el('div', {}, [
        step.title && el('h3', { class: 'step__title', text: tr(step.title, lang) }),
        el('p', { class: 'step__text', html: stepHTML(tr(step.text, lang), scale) })
      ])
    ]);
    if (step.timer) li.append(timerWidget(step.timer, i, t));
    host.append(li);
  });
}

let audioCtx = null;
function beep() {
  try {
    audioCtx ??= new (window.AudioContext ?? window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.4);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 1.5);
  } catch { /* audio non disponibile */ }
}

function timerWidget(seconds, i, t) {
  const output = el('output', { text: clock(seconds) });
  const button = el('button', { class: 'btn btn--secondary', type: 'button', text: t('timer.start') });
  const box = el('div', { class: 'timer', 'data-running': 'false' }, [button, output]);
  let handle = null;
  let left = seconds;
  let lock = null;

  const stop = () => {
    clearInterval(handle);
    handle = null;
    box.dataset.running = 'false';
    button.textContent = t('timer.start');
    lock?.release?.().catch(() => {});
    lock = null;
  };

  button.addEventListener('click', async () => {
    if (handle) { stop(); left = seconds; output.textContent = clock(left); box.dataset.done = 'false'; return; }
    box.dataset.running = 'true';
    box.dataset.done = 'false';
    button.textContent = t('timer.stop');
    try { lock = await navigator.wakeLock?.request?.('screen'); } catch { /* niente wake lock */ }
    handle = setInterval(() => {
      left -= 1;
      output.textContent = left > 0 ? clock(left) : t('timer.done');
      if (left <= 0) { box.dataset.done = 'true'; stop(); left = seconds; beep(); }
    }, 1000);
  });

  return box;
}

/* ---------- testata e note ---------- */

function renderHead() {
  const t = state.t;
  const recipe = state.recipe;
  const time = recipe.time ?? {};
  const total = (time.prep ?? 0) + (time.rest ?? 0) + (time.cook ?? 0);

  document.title = `${tr(recipe.title, lang)} — ${t('site.title')}`;
  document.getElementById('title').textContent = tr(recipe.title, lang);
  document.getElementById('lede').textContent = tr(recipe.summary, lang);

  const photo = document.getElementById('photo');
  if (recipe.image) {
    const photoImg = document.getElementById('photoImg');
    photoImg.src = recipe.image;
    photoImg.alt = tr(recipe.title, lang);
    photoImg.style.objectPosition = recipe.imageFocus ?? '';
    photo.hidden = false;
  } else {
    photo.hidden = true;
  }

  const facts = [
    time.prep && [t('time.prep'), minutes(time.prep, t)],
    time.rest && [t('time.rest'), minutes(time.rest, t)],
    time.cook && [t('time.cook'), minutes(time.cook, t)],
    total && [t('time.total'), minutes(total, t)],
    recipe.method && [t('method.label'), t(`method.${recipe.method}`)],
    recipe.difficulty && [t('difficulty.label'), t(`difficulty.${recipe.difficulty}`)]
  ].filter(Boolean);

  document.getElementById('facts').replaceChildren(
    ...facts.map(([label, value]) => el('li', { class: 'label', text: label }, [el('b', { text: value })]))
  );

  const source = document.getElementById('source');
  if (recipe.source?.url) {
    source.replaceChildren(
      document.createTextNode(`${t('recipe.source')} `),
      el('a', { href: recipe.source.url, rel: 'noreferrer noopener', target: '_blank', text: recipe.source.name })
    );
  } else source.hidden = true;

  const gallery = recipe.gallery ?? [];
  const gallerySection = document.getElementById('gallerySection');
  if (gallery.length) {
    document.getElementById('galleryTitle').textContent = t('recipe.gallery');
    document.getElementById('photogrid').replaceChildren(
      ...gallery.map((shot) =>
        el('li', {}, [
          el('a', { href: shot.image, target: '_blank', rel: 'noreferrer noopener' }, [
            el('img', { src: shot.image, alt: tr(shot.caption, lang) ?? '', loading: 'lazy' })
          ]),
          tr(shot.caption, lang) && el('p', { text: tr(shot.caption, lang) })
        ])
      )
    );
    gallerySection.hidden = false;
  } else {
    gallerySection.hidden = true;
  }

  const notes = recipe.notes ?? [];
  if (!notes.length) { document.getElementById('notes').hidden = true; return; }
  document.getElementById('notesTitle').textContent = t('recipe.notes');
  document.getElementById('notesList').replaceChildren(
    ...notes.flatMap((note) => [
      el('dt', { class: 'label', text: tr(note.title, lang) }),
      el('dd', { html: inlineMarkdown(tr(note.text, lang)) })
    ])
  );
}

function wireControls() {
  const t = state.t;
  const back = document.getElementById('back');
  back.replaceChildren();
  back.insertAdjacentHTML('afterbegin', icons.back);
  back.append(document.createTextNode(t('recipe.back')));
  back.href = `index.html?lang=${lang}`;
  document.getElementById('ingredientsTitle').textContent = t('recipe.ingredients');
  document.getElementById('stepsTitle').textContent = t('recipe.steps');
  document.getElementById('macrosTitle').textContent = t('macros.title');
  document.getElementById('servingsLabel').textContent = t('recipe.servings');
  document.getElementById('macroNote').textContent = t('macros.estimate');

  const less = document.getElementById('less');
  const more = document.getElementById('more');
  const out = document.getElementById('servingsValue');
  less.innerHTML = icons.minus;
  more.innerHTML = icons.plus;
  less.title = t('recipe.servingsDecrease');
  more.title = t('recipe.servingsIncrease');
  less.setAttribute('aria-label', t('recipe.servingsDecrease'));
  more.setAttribute('aria-label', t('recipe.servingsIncrease'));

  const step = state.base >= 12 ? Math.max(1, Math.round(state.base / 4)) : 1;
  const paint = () => {
    out.value = `${state.servings}`;
    less.disabled = state.servings - step < step;
    renderIngredients();
    renderMacros();
    renderSteps();
  };
  less.addEventListener('click', () => { state.servings = Math.max(step, state.servings - step); paint(); });
  more.addEventListener('click', () => { state.servings += step; paint(); });

  const toggle = document.getElementById('macroToggle');
  toggle.replaceChildren(
    ...[['serving', 'macros.perServing'], ['total', 'macros.total']].map(([view, key]) =>
      el('button', {
        type: 'button', text: t(key), 'aria-pressed': String(state.view === view),
        onclick: (event) => {
          state.view = view;
          for (const btn of toggle.querySelectorAll('button')) btn.setAttribute('aria-pressed', 'false');
          event.currentTarget.setAttribute('aria-pressed', 'true');
          renderMacros();
        }
      })
    )
  );

  const print = document.getElementById('print');
  print.textContent = t('recipe.print');
  print.addEventListener('click', () => window.print());

  const reset = document.getElementById('reset');
  reset.textContent = t('recipe.uncheckAll');
  reset.addEventListener('click', () => { store.set(checkedKey(), []); renderIngredients(); });

  paint();
}

async function main() {
  if (!slug) throw new Error('slug mancante');
  const [ui, foods, recipe] = await Promise.all([loadUI(lang), loadFoods(), loadRecipe(slug)]);
  state.ui = ui;
  state.t = makeT(ui, lang);
  state.foods = foods;
  state.recipe = recipe;
  state.base = recipe.yield?.count ?? 1;
  state.servings = state.base;
  initNav({ t: state.t, lang, active: 'home', toggleTheme });
  renderHead();
  wireControls();
}

main().catch((error) => {
  console.error(error);
  document.getElementById('main').replaceChildren(
    el('div', { class: 'empty' }, [
      el('h2', { text: 'Ricetta non trovata' }),
      el('p', { text: 'Controlla il link, oppure torna all’elenco.' }),
      el('p', {}, [el('a', { href: 'index.html', text: '← Tutte le ricette' })])
    ])
  );
});
