import { tr, makeT, unitLabel, detectLang } from './lib/i18n.js';
import { loadFoods, loadRecipe, loadUI, el, num, minutes, clock, inlineMarkdown, initTheme, store } from './lib/data.js';
import { computeNutrition, energySplit, flatIngredients, MACRO_KEYS } from './lib/nutrition.js';
import { toGrams, roundQty } from './lib/units.js';
import { initNav, icons } from './lib/nav.js';

const lang = detectLang();
const toggleTheme = initTheme();
const slug = new URLSearchParams(location.search).get('r');

const state = { recipe: null, foods: null, t: null, ui: null, servings: 1, base: 1, view: 'serving', metric: 'kcal' };

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

/**
 * Per cosa dividere i totali nella vista scelta, e come chiamarla.
 * Un posto solo, così il pannello e il dettaglio non possono divergere.
 * `divisor` è null quando la vista non è calcolabile (nessun ingrediente
 * pesabile ⇒ niente "per 100 g").
 */
function viewScale(result) {
  const t = state.t;
  if (state.view === 'total') return { divisor: 1, label: t('macros.total') };
  if (state.view === 'per100') {
    return { divisor: result.grams > 0 ? result.grams / 100 : null, label: t('macros.per100') };
  }
  return { divisor: result.servings || 1, label: t('macros.perServing') };
}

function renderMacros() {
  const t = state.t;
  const scale = state.servings / state.base;
  const result = computeNutrition(state.recipe, state.foods, { scale });
  const { divisor, label } = viewScale(result);
  const macros = Object.fromEntries(
    MACRO_KEYS.map((k) => [k, divisor ? result.totals[k] / divisor : null])
  );
  const split = energySplit(macros);

  document.getElementById('kcalValue').textContent = num(macros.kcal);
  document.getElementById('kcalUnit').textContent = `kcal · ${label.toLowerCase()}`;

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

  // il "per 100 g" merita un avvertimento in più: è sul crudo pesato
  document.getElementById('macroNote').textContent =
    state.view === 'per100' ? t('macros.per100Note') : t('macros.estimate');

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

/* ---------- da dove arrivano le macro ---------- */

// Quale colore usa la barra, per ogni metrica.
const METRICS = [
  { key: 'kcal', unit: '', color: 'var(--accent)' },
  { key: 'protein', unit: 'g', color: 'var(--protein)' },
  { key: 'carbs', unit: 'g', color: 'var(--carbs)' },
  { key: 'fat', unit: 'g', color: 'var(--fat)' }
];

function ingredientLabel(contribution) {
  return tr(contribution.label, lang)
    || tr(state.foods[contribution.food]?.name, lang)
    || contribution.food;
}

function renderBreakdown() {
  const t = state.t;
  const scale = state.servings / state.base;
  const result = computeNutrition(state.recipe, state.foods, { scale });
  const { contributions, totals } = result;
  const metric = METRICS.find((m) => m.key === state.metric) ?? METRICS[0];
  const { divisor: rawDivisor, label: viewLabel } = viewScale(result);
  const divisor = rawDivisor || 1;

  const counted = contributions.filter((c) => c.grams != null);
  const excluded = contributions.filter((c) => c.grams == null);

  const value = (c) => c.macros[metric.key] / divisor;
  const totalValue = totals[metric.key] / divisor;

  const fmt = (v) => `${num(v, v < 10 && v > 0 ? 1 : 0)}${metric.unit ? ' ' + metric.unit : ''}`;

  document.getElementById('breakdownLead').innerHTML =
    `${t(`macros.${metric.key}`)}: <b>${fmt(totalValue)}${metric.key === 'kcal' ? ' kcal' : ''}</b> · ` +
    `${viewLabel.toLowerCase()}`;

  const rows = [...counted].sort((a, b) => value(b) - value(a));
  document.getElementById('contribList').replaceChildren(
    ...rows.map((c) => {
      const v = value(c);
      const share = totalValue > 0 ? (v / totalValue) * 100 : 0;
      return el('li', { class: `contrib__row${v <= 0 ? ' is-zero' : ''}` }, [
        el('div', { class: 'contrib__top' }, [
          el('span', { class: 'contrib__name', text: ingredientLabel(c) }),
          el('span', { class: 'contrib__val', text: fmt(v) })
        ]),
        // la barra è la quota sul totale: così lunghezza e percentuale
        // raccontano la stessa cosa
        el('div', { class: 'contrib__track' }, [
          el('span', {
            class: 'contrib__fill',
            style: `width:${Math.max(0, share)}%;--metric:${metric.color}`
          })
        ]),
        el('div', {
          class: 'contrib__sub',
          text: `${num(c.grams / divisor)} g · ${num(share)}%`
        })
      ]);
    })
  );

  const box = document.getElementById('contribExcluded');
  if (excluded.length) {
    box.hidden = false;
    document.getElementById('contribExcludedTitle').textContent = t('macros.excludedTitle');
    document.getElementById('contribExcludedList').textContent =
      excluded.map(ingredientLabel).join(' · ');
  } else box.hidden = true;

  document.getElementById('breakdownNote').textContent = t('macros.breakdownNote');
}

function wireBreakdown() {
  const t = state.t;
  const dialog = document.getElementById('breakdown');
  const open = document.getElementById('breakdownOpen');
  const close = document.getElementById('breakdownClose');

  open.querySelector('span').textContent = t('macros.breakdown');
  document.getElementById('breakdownTitle').textContent = t('macros.breakdown');
  close.innerHTML = icons.close;
  close.setAttribute('aria-label', t('nav.close'));

  const metrics = document.getElementById('breakdownMetric');
  metrics.setAttribute('aria-label', t('macros.breakdownMetric'));
  metrics.replaceChildren(
    ...METRICS.map((m) =>
      el('button', {
        type: 'button',
        text: t(`macros.${m.key}`),
        'aria-pressed': String(state.metric === m.key),
        onclick: (event) => {
          state.metric = m.key;
          for (const b of metrics.querySelectorAll('button')) b.setAttribute('aria-pressed', 'false');
          event.currentTarget.setAttribute('aria-pressed', 'true');
          renderBreakdown();
        }
      })
    )
  );

  open.addEventListener('click', () => { renderBreakdown(); dialog.showModal(); });
  close.addEventListener('click', () => dialog.close());
  // clic sullo sfondo: il target è il dialog stesso solo se si è fuori dal riquadro
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    const fuori =
      event.clientY < box.top || event.clientY > box.bottom ||
      event.clientX < box.left || event.clientX > box.right;
    if (fuori) dialog.close();
  });
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
  // la nota sotto le macro la scrive renderMacros: cambia con la vista

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
  const dialog = document.getElementById('breakdown');
  const paint = () => {
    out.value = `${state.servings}`;
    less.disabled = state.servings - step < step;
    renderIngredients();
    renderMacros();
    renderSteps();
    // se il dettaglio è aperto, deve seguire il cambio di porzioni
    if (dialog.open) renderBreakdown();
  };
  less.addEventListener('click', () => { state.servings = Math.max(step, state.servings - step); paint(); });
  more.addEventListener('click', () => { state.servings += step; paint(); });

  const toggle = document.getElementById('macroToggle');
  toggle.replaceChildren(
    ...[
      ['serving', 'macros.viewServing'],
      ['total', 'macros.viewTotal'],
      ['per100', 'macros.view100']
    ].map(([view, key]) =>
      el('button', {
        type: 'button', text: t(key), 'aria-pressed': String(state.view === view),
        onclick: (event) => {
          state.view = view;
          for (const btn of toggle.querySelectorAll('button')) btn.setAttribute('aria-pressed', 'false');
          event.currentTarget.setAttribute('aria-pressed', 'true');
          renderMacros();
          if (dialog.open) renderBreakdown();
        }
      })
    )
  );

  wireBreakdown();

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
