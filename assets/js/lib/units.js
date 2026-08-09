// Conversione delle quantità di ricetta in grammi.
// Usato sia dal sito (browser) sia dagli script in scripts/ (Node).

export const MASS_G = { mg: 0.001, g: 1, hg: 100, kg: 1000 };

export const VOLUME_ML = {
  ml: 1,
  cl: 10,
  dl: 100,
  l: 1000,
  cucchiaino: 5,
  cucchiaio: 15,
  bicchiere: 200,
  tazza: 240
};

/** Unità che non richiedono nessuna quantità numerica. */
export const OPEN_UNITS = new Set(['qb']);

export function isMass(unit) { return Object.hasOwn(MASS_G, unit); }
export function isVolume(unit) { return Object.hasOwn(VOLUME_ML, unit); }

/**
 * Converte { qty, unit } in grammi usando i dati dell'alimento.
 * Ritorna { grams, exact, issue }:
 *  - grams: numero, oppure null se non calcolabile
 *  - exact: false quando abbiamo dovuto stimare (es. densità mancante)
 *  - issue: codice del problema, per i messaggi in interfaccia
 */
export function toGrams(item, food) {
  const { qty, unit } = item;

  if (unit && OPEN_UNITS.has(unit)) return { grams: null, exact: false, issue: 'open-quantity' };
  if (qty == null || Number.isNaN(qty)) return { grams: null, exact: false, issue: 'no-quantity' };

  if (!unit || unit === 'pz') {
    const w = food?.pieceWeight;
    if (!w) return { grams: null, exact: false, issue: 'no-piece-weight' };
    return { grams: qty * w, exact: true, issue: null };
  }

  if (isMass(unit)) return { grams: qty * MASS_G[unit], exact: true, issue: null };

  if (food?.units && Object.hasOwn(food.units, unit)) {
    return { grams: qty * food.units[unit], exact: true, issue: null };
  }

  if (isVolume(unit)) {
    const ml = qty * VOLUME_ML[unit];
    if (food?.density) return { grams: ml * food.density, exact: true, issue: null };
    // Fallback: densità dell'acqua. Meglio di niente, ma segnalato.
    return { grams: ml, exact: false, issue: 'no-density' };
  }

  return { grams: null, exact: false, issue: 'unknown-unit' };
}

/** Arrotondamento leggibile per le quantità mostrate a schermo. */
export function roundQty(value, unit) {
  if (value == null) return null;
  const abs = Math.abs(value);
  if (unit === 'kg' || unit === 'l') return Math.round(value * 100) / 100;
  if (!unit || unit === 'pz') return Math.round(value * 4) / 4; // mezzi e quarti
  if (isVolume(unit) && VOLUME_ML[unit] <= 15) return Math.round(value * 4) / 4;
  if (abs >= 100) return Math.round(value / 5) * 5;
  if (abs >= 10) return Math.round(value);
  return Math.round(value * 10) / 10;
}
