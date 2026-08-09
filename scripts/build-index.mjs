#!/usr/bin/env node
// Rigenera data/recipes/index.json leggendo tutti i file di ricetta.
// L'indice contiene solo ciò che serve alla home: titolo, tag, tempi,
// kcal per porzione (precalcolate) e una stringa di ricerca per lingua.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeNutrition, flatIngredients } from '../assets/js/lib/nutrition.js';
import { LANGS, tr } from '../assets/js/lib/i18n.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const recipesDir = join(root, 'data', 'recipes');

const foods = JSON.parse(await readFile(join(root, 'data', 'foods.json'), 'utf8')).foods;

const files = (await readdir(recipesDir))
  .filter((name) => name.endsWith('.json') && name !== 'index.json')
  .sort();

const recipes = [];

for (const file of files) {
  const recipe = JSON.parse(await readFile(join(recipesDir, file), 'utf8'));
  const { perServing, coverage } = computeNutrition(recipe, foods);

  const search = {};
  for (const lang of LANGS) {
    const words = [
      tr(recipe.title, lang),
      tr(recipe.summary, lang),
      ...flatIngredients(recipe).map((item) =>
        [tr(item.label, lang), tr(foods[item.food]?.name, lang)].filter(Boolean).join(' ')
      ),
      ...(recipe.steps ?? []).map((step) => tr(step.title, lang))
    ];
    search[lang] = words.filter(Boolean).join(' · ');
  }

  recipes.push({
    slug: recipe.slug ?? file.replace(/\.json$/, ''),
    added: recipe.added ?? null,
    title: recipe.title,
    summary: recipe.summary,
    tags: recipe.tags ?? [],
    method: recipe.method ?? null,
    difficulty: recipe.difficulty ?? null,
    cost: recipe.cost ?? null,
    time: recipe.time ?? {},
    yield: recipe.yield ?? null,
    kcalPerServing: Math.round(perServing.kcal),
    coverage: Math.round(coverage * 100) / 100,
    search
  });
}

recipes.sort((a, b) => String(b.added ?? '').localeCompare(String(a.added ?? '')));

await writeFile(
  join(recipesDir, 'index.json'),
  `${JSON.stringify({ generated: new Date().toISOString(), count: recipes.length, recipes }, null, 2)}\n`,
  'utf8'
);

console.log(`index.json aggiornato · ${recipes.length} ricette`);
for (const r of recipes) {
  console.log(`  ${r.slug.padEnd(38)} ${String(r.kcalPerServing).padStart(5)} kcal/porz · dati ${Math.round(r.coverage * 100)}%`);
}
