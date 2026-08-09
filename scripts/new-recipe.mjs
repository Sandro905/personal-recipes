#!/usr/bin/env node
// Crea un file ricetta già compilato con la struttura giusta.
//   node scripts/new-recipe.mjs "Torta all'acqua al cacao"
// Poi apri il file, riempi ingredienti e passaggi, e lancia: npm run build

import { writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const title = process.argv.slice(2).join(' ').trim();
if (!title) {
  console.error('Uso: node scripts/new-recipe.mjs "Titolo della ricetta"');
  process.exit(1);
}

const slugify = (text) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

const slug = slugify(title);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = join(root, 'data', 'recipes', `${slug}.json`);

try {
  await access(path);
  console.error(`Esiste già: data/recipes/${slug}.json`);
  process.exit(1);
} catch { /* libero, procediamo */ }

const template = {
  slug,
  added: new Date().toISOString().slice(0, 10),
  title: { it: title },
  summary: { it: '' },
  yield: { count: 4, label: { it: 'persone', en: 'servings' } },
  time: { prep: 0, rest: 0, cook: 0 },
  difficulty: 'facile',
  cost: 'economico',
  method: 'forno',
  tags: [],
  source: { name: '', url: '' },
  ingredients: [
    {
      section: null,
      items: [{ food: 'farina-00', qty: 200, unit: 'g' }]
    }
  ],
  steps: [
    { title: { it: '' }, text: { it: 'Usa {{farina-00}} per inserire la quantità nel testo.' }, timer: null }
  ],
  notes: [{ title: { it: 'Conservazione' }, text: { it: '' } }]
};

await writeFile(path, `${JSON.stringify(template, null, 2)}\n`, 'utf8');
console.log(`Creato data/recipes/${slug}.json`);
console.log('Compila il file, poi: npm run build');
