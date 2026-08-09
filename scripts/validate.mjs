#!/usr/bin/env node
// Controlla le ricette prima di pubblicare: riferimenti agli alimenti,
// unità convertibili, segnaposto {{alimento}} nei passaggi, campi obbligatori.
// Esce con codice 1 se trova errori (utile in una GitHub Action).

import { readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toGrams, MASS_G, VOLUME_ML, OPEN_UNITS } from '../assets/js/lib/units.js';
import { flatIngredients, MACRO_KEYS } from '../assets/js/lib/nutrition.js';
import { LANGS, DEFAULT_LANG } from '../assets/js/lib/i18n.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const recipesDir = join(root, 'data', 'recipes');
const foods = JSON.parse(await readFile(join(root, 'data', 'foods.json'), 'utf8')).foods;

const errors = [];
const warnings = [];

/* --- database alimenti --- */
for (const [id, food] of Object.entries(foods)) {
  if (!/^[a-z0-9-]+$/.test(id)) errors.push(`foods.json · id non valido: "${id}"`);
  if (!food.name?.[DEFAULT_LANG]) errors.push(`foods.json · ${id}: manca name.${DEFAULT_LANG}`);
  for (const key of MACRO_KEYS) {
    if (typeof food.per100g?.[key] !== 'number') warnings.push(`foods.json · ${id}: ${key} mancante`);
  }
  for (const lang of LANGS) {
    if (!food.name?.[lang]) warnings.push(`foods.json · ${id}: nome mancante in "${lang}"`);
  }
}

/* --- ricette --- */
const files = (await readdir(recipesDir)).filter((f) => f.endsWith('.json') && f !== 'index.json');
if (!files.length) warnings.push('nessuna ricetta in data/recipes/');

for (const file of files) {
  const label = `data/recipes/${file}`;
  let recipe;
  try {
    recipe = JSON.parse(await readFile(join(recipesDir, file), 'utf8'));
  } catch (error) {
    errors.push(`${label} · JSON non valido: ${error.message}`);
    continue;
  }

  const expected = `${recipe.slug}.json`;
  if (!recipe.slug) errors.push(`${label} · manca "slug"`);
  else if (expected !== file) errors.push(`${label} · lo slug non combacia col nome file (atteso ${expected})`);
  if (!recipe.title?.[DEFAULT_LANG]) errors.push(`${label} · manca title.${DEFAULT_LANG}`);
  if (!recipe.yield?.count) errors.push(`${label} · manca yield.count`);
  if (!recipe.steps?.length) errors.push(`${label} · nessun passaggio`);

  const items = flatIngredients(recipe);
  if (!items.length) errors.push(`${label} · nessun ingrediente`);

  for (const item of items) {
    if (!foods[item.food]) {
      errors.push(`${label} · alimento sconosciuto: "${item.food}" (aggiungilo a foods.json)`);
      continue;
    }
    const unit = item.unit;
    const known =
      !unit ||
      unit === 'pz' ||
      OPEN_UNITS.has(unit) ||
      Object.hasOwn(MASS_G, unit) ||
      Object.hasOwn(VOLUME_ML, unit) ||
      Object.hasOwn(foods[item.food].units ?? {}, unit);
    if (!known) errors.push(`${label} · unità non riconosciuta "${unit}" per ${item.food}`);

    const { grams, exact, issue } = toGrams(item, foods[item.food]);
    if (grams == null && issue !== 'open-quantity') {
      warnings.push(`${label} · ${item.food}: non convertibile in grammi (${issue}) → escluso dalle macro`);
    } else if (!exact) {
      warnings.push(`${label} · ${item.food}: conversione stimata (${issue})`);
    }
  }

  for (const [i, step] of (recipe.steps ?? []).entries()) {
    for (const lang of LANGS) {
      const text = step.text?.[lang];
      if (!text) continue;
      for (const match of text.matchAll(/\{\{([a-z0-9-]+)(?:#(\d+))?\}\}/gi)) {
        const [, food, nth] = match;
        const count = items.filter((item) => item.food === food).length;
        const wanted = Number(nth) || 1;
        if (!count) errors.push(`${label} · passaggio ${i + 1} (${lang}): {{${food}}} non è tra gli ingredienti`);
        else if (wanted > count) {
          errors.push(`${label} · passaggio ${i + 1} (${lang}): {{${food}#${wanted}}} ma ci sono ${count} occorrenze`);
        }
      }
    }
    if (!step.text?.[DEFAULT_LANG]) errors.push(`${label} · passaggio ${i + 1}: manca text.${DEFAULT_LANG}`);
  }

  for (const lang of LANGS) {
    if (lang === DEFAULT_LANG) continue;
    if (!recipe.title?.[lang]) warnings.push(`${label} · traduzione "${lang}" assente`);
  }
}

/* --- report --- */
for (const line of warnings) console.log(`  avviso  ${line}`);
for (const line of errors) console.error(`  errore  ${line}`);

console.log(`\n${files.length} ricette · ${Object.keys(foods).length} alimenti · ${errors.length} errori · ${warnings.length} avvisi`);
process.exit(errors.length ? 1 : 0);
