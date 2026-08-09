#!/usr/bin/env node
/*
 * Aggiunge una voce a data/foods.json prendendo i valori da un database esterno.
 *
 *   # ingrediente generico, da USDA FoodData Central (serve una API key gratuita)
 *   FDC_API_KEY=xxxx node scripts/import-food.mjs usda "potato raw" --id patate --name-it patate --piece 150
 *
 *   # prodotto confezionato, da Open Food Facts (nessuna chiave, basta il codice a barre)
 *   node scripts/import-food.mjs off 80176392 --id passata-pomodoro --name-it "passata di pomodoro" --density 1.05
 *
 * Opzioni: --id (obbligatoria) --name-it --name-en --category --density --piece
 *          --unit nome=grammi (ripetibile)  --dry-run
 *
 * Nota sulle licenze: USDA FDC è di pubblico dominio; Open Food Facts è ODbL,
 * quindi se un giorno pubblichi il database va citata la fonte (già salvata in "source").
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const foodsPath = join(root, 'data', 'foods.json');

/* ---------- argomenti ---------- */
const argv = process.argv.slice(2);
const [source, ...rest] = argv;
const positional = [];
const opts = { unit: {} };

for (let i = 0; i < rest.length; i += 1) {
  const arg = rest[i];
  if (!arg.startsWith('--')) { positional.push(arg); continue; }
  const key = arg.slice(2);
  if (key === 'dry-run') { opts.dryRun = true; continue; }
  const value = rest[++i];
  if (key === 'unit') {
    const [name, grams] = String(value).split('=');
    opts.unit[name] = Number(grams);
  } else opts[key] = value;
}

const query = positional.join(' ');

if (!['usda', 'off'].includes(source) || !query || !opts.id) {
  console.error('Uso: node scripts/import-food.mjs <usda|off> <query|barcode> --id <slug> [opzioni]');
  process.exit(1);
}

/* ---------- USDA FoodData Central ---------- */
const FDC = { 1008: 'kcal', 1003: 'protein', 1005: 'carbs', 1004: 'fat', 1079: 'fiber', 2000: 'sugars', 1093: 'sodium' };

async function fromUSDA(text) {
  const key = process.env.FDC_API_KEY;
  if (!key) throw new Error('Manca FDC_API_KEY (chiave gratuita su fdc.nal.usda.gov/api-key-signup.html)');

  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  url.searchParams.set('query', text);
  url.searchParams.set('pageSize', '5');
  url.searchParams.set('dataType', 'Foundation,SR Legacy');
  url.searchParams.set('api_key', key);

  const res = await fetch(url);
  if (!res.ok) throw new Error(`USDA ha risposto ${res.status}`);
  const data = await res.json();
  const hit = data.foods?.[0];
  if (!hit) throw new Error(`Nessun risultato USDA per "${text}"`);

  const per100g = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugars: 0, salt: 0 };
  let sodiumMg = 0;
  for (const nutrient of hit.foodNutrients ?? []) {
    const field = FDC[nutrient.nutrientId];
    if (!field) continue;
    if (field === 'sodium') sodiumMg = nutrient.value ?? 0;
    else per100g[field] = nutrient.value ?? 0;
  }
  per100g.salt = Math.round((sodiumMg * 2.5) / 1000 * 100) / 100;

  return {
    per100g,
    nameEn: hit.description,
    source: { db: 'usda-fdc', id: String(hit.fdcId), retrieved: new Date().toISOString().slice(0, 10) }
  };
}

/* ---------- Open Food Facts ---------- */
async function fromOFF(barcode) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`;
  const res = await fetch(url, { headers: { 'User-Agent': 'quaderno-di-cucina/1.0 (uso personale)' } });
  if (!res.ok) throw new Error(`Open Food Facts ha risposto ${res.status}`);
  const data = await res.json();
  if (data.status !== 1) throw new Error(`Prodotto ${barcode} non trovato su Open Food Facts`);

  const n = data.product.nutriments ?? {};
  const pick = (key) => Number(n[`${key}_100g`] ?? 0);

  return {
    per100g: {
      kcal: Math.round(Number(n['energy-kcal_100g'] ?? 0)),
      protein: pick('proteins'),
      carbs: pick('carbohydrates'),
      fat: pick('fat'),
      fiber: pick('fiber'),
      sugars: pick('sugars'),
      salt: pick('salt')
    },
    nameEn: data.product.product_name_en || data.product.product_name,
    nameIt: data.product.product_name_it,
    source: { db: 'openfoodfacts', id: String(barcode), license: 'ODbL', retrieved: new Date().toISOString().slice(0, 10) }
  };
}

/* ---------- scrittura ---------- */
const result = source === 'usda' ? await fromUSDA(query) : await fromOFF(query);

const entry = {
  name: {
    it: opts['name-it'] ?? result.nameIt ?? result.nameEn ?? opts.id,
    en: opts['name-en'] ?? result.nameEn ?? opts.id
  },
  category: opts.category ?? 'da-classificare',
  per100g: result.per100g,
  ...(opts.density ? { density: Number(opts.density) } : {}),
  ...(opts.piece ? { pieceWeight: Number(opts.piece) } : {}),
  ...(Object.keys(opts.unit).length ? { units: opts.unit } : {}),
  source: result.source
};

const db = JSON.parse(await readFile(foodsPath, 'utf8'));
const existed = Boolean(db.foods[opts.id]);
db.foods[opts.id] = entry;
db.foods = Object.fromEntries(Object.entries(db.foods).sort(([a], [b]) => a.localeCompare(b)));

console.log(JSON.stringify({ [opts.id]: entry }, null, 2));

if (opts.dryRun) {
  console.log('\n--dry-run: niente scritto su disco.');
} else {
  await writeFile(foodsPath, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
  console.log(`\n${existed ? 'Aggiornato' : 'Aggiunto'} "${opts.id}" in data/foods.json`);
}
