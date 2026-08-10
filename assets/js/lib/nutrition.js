// Calcolo dei valori nutrizionali di una ricetta.
// Condiviso tra browser e script Node: nessuna dipendenza dal DOM.

import { toGrams } from './units.js';

export const MACRO_KEYS = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugars', 'salt'];

function emptyTotals() {
  return Object.fromEntries(MACRO_KEYS.map((k) => [k, 0]));
}

/** Appiattisce le sezioni di ingredienti in un unico elenco. */
export function flatIngredients(recipe) {
  const out = [];
  for (const section of recipe.ingredients ?? []) {
    for (const item of section.items ?? []) out.push({ ...item, section: section.section ?? null });
  }
  return out;
}

/**
 * Somma le macro di tutti gli ingredienti.
 * Ritorna { totals, perServing, servings, grams, warnings, coverage }.
 * `warnings` elenca gli ingredienti esclusi o stimati, così l'interfaccia può dirlo.
 */
export function computeNutrition(recipe, foods, { scale = 1 } = {}) {
  const totals = emptyTotals();
  const warnings = [];
  // Contributo di ogni singolo ingrediente, per il dettaglio "da dove arrivano".
  const contributions = [];
  let countedGrams = 0;
  let counted = 0;
  let total = 0;

  for (const item of flatIngredients(recipe)) {
    total += 1;
    const food = foods[item.food];

    if (!food) {
      warnings.push({ food: item.food, issue: 'unknown-food' });
      contributions.push({ food: item.food, label: item.label ?? null, grams: null, macros: emptyTotals(), issue: 'unknown-food' });
      continue;
    }

    const { grams, exact, issue } = toGrams(item, food);

    if (grams == null) {
      if (issue !== 'open-quantity' || (food.per100g?.kcal ?? 0) > 0) {
        warnings.push({ food: item.food, issue });
      }
      contributions.push({ food: item.food, label: item.label ?? null, grams: null, macros: emptyTotals(), issue });
      continue;
    }
    if (!exact) warnings.push({ food: item.food, issue });

    const factor = (grams * scale) / 100;
    const macros = emptyTotals();
    for (const key of MACRO_KEYS) {
      macros[key] = (food.per100g?.[key] ?? 0) * factor;
      totals[key] += macros[key];
    }
    countedGrams += grams * scale;
    counted += 1;
    contributions.push({ food: item.food, label: item.label ?? null, grams: grams * scale, macros, issue: exact ? null : issue });
  }

  const servings = (recipe.yield?.count ?? 1) * scale;
  const perServing = Object.fromEntries(
    MACRO_KEYS.map((k) => [k, servings > 0 ? totals[k] / servings : 0])
  );

  return {
    totals,
    perServing,
    servings,
    grams: countedGrams,
    warnings,
    contributions,
    coverage: total === 0 ? 1 : counted / total
  };
}

/** Ripartizione calorica in percentuale (per la barra impilata). */
export function energySplit(macros) {
  const parts = {
    protein: (macros.protein ?? 0) * 4,
    carbs: (macros.carbs ?? 0) * 4,
    fat: (macros.fat ?? 0) * 9
  };
  const sum = parts.protein + parts.carbs + parts.fat;
  if (sum <= 0) return { protein: 0, carbs: 0, fat: 0 };
  return {
    protein: (parts.protein / sum) * 100,
    carbs: (parts.carbs / sum) * 100,
    fat: (parts.fat / sum) * 100
  };
}
