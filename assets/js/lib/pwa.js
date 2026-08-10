// Copia locale del sito e avvisi relativi.
//
// Il service worker (sw.js, generato) salva il sito nel browser: dopo la prima
// visita le pagine si aprono dalla memoria del telefono, anche senza rete.
// Una copia salvata però va sostituita quando il sito cambia, ed è questo il
// punto delicato: qui si aspetta che la nuova versione sia pronta e si lascia
// all'utente il momento del ricaricamento, invece di cambiargli la pagina
// sotto le dita mentre sta leggendo una ricetta.

import { el } from './data.js';

/* ---------- avvisi in basso ---------- */

let pila = null;

function contenitore() {
  if (!pila) {
    pila = el('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
    document.body.append(pila);
  }
  return pila;
}

/**
 * @param {object} opts
 * @param {string} opts.text
 * @param {string} [opts.action]   etichetta del pulsante
 * @param {() => void} [opts.onAction]
 * @param {number} [opts.timeout]  ms prima di sparire da solo; 0 = resta
 * @param {string} [opts.closeLabel]
 */
function avviso({ text, action, onAction, timeout = 0, closeLabel = 'Chiudi' }) {
  const nodo = el('div', { class: 'toast' }, [el('span', { class: 'toast__text', text })]);

  const chiudi = () => {
    if (!nodo.isConnected) return;
    nodo.classList.remove('is-open');
    nodo.addEventListener('transitionend', () => nodo.remove(), { once: true });
    setTimeout(() => nodo.remove(), 400); // se le transizioni sono disattivate
  };

  if (action) {
    nodo.append(el('button', { class: 'toast__action', type: 'button', text: action, onclick: onAction }));
  }
  nodo.append(
    el('button', {
      class: 'toast__close',
      type: 'button',
      'aria-label': closeLabel,
      html: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
      onclick: chiudi
    })
  );

  contenitore().append(nodo);
  requestAnimationFrame(() => nodo.classList.add('is-open'));
  if (timeout) setTimeout(chiudi, timeout);
  return chiudi;
}

/* ---------- registrazione ---------- */

// Il ricaricamento avviene solo dopo un "Aggiorna": il cambio di service worker
// da solo (prima installazione, aggiornamento partito da un'altra scheda) non
// deve far saltare la pagina a chi sta leggendo.
let ricaricaAttesa = false;

/**
 * @param {object} opts
 * @param {(path: string, vars?: object) => string} opts.t
 */
export function initPWA({ t }) {
  statoRete(t);

  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;

  // Le pagine chiamano initPWA quando hanno finito di disegnarsi, cioè spesso
  // a "load" già passato: appendersi all'evento e basta significherebbe non
  // registrare mai niente.
  if (document.readyState === 'complete') registra(t);
  else window.addEventListener('load', () => registra(t), { once: true });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!ricaricaAttesa) return;
    ricaricaAttesa = false;
    location.reload();
  });
}

async function registra(t) {
  let registrazione;
  try {
    registrazione = await navigator.serviceWorker.register('sw.js', {
      scope: './',
      // sw.js non deve mai arrivare dalla cache HTTP, altrimenti gli
      // aggiornamenti si accorgerebbero di esistere con ore di ritardo
      updateViaCache: 'none'
    });
  } catch {
    return; // niente copia locale: il sito funziona lo stesso, con la rete
  }

  versioneInPiede();
  prefetchFoto();

  // Una copia nuova può essere già pronta da una visita precedente.
  if (registrazione.waiting && navigator.serviceWorker.controller) {
    proponiAggiornamento(t, registrazione.waiting);
  }

  registrazione.addEventListener('updatefound', () => {
    const nuovo = registrazione.installing;
    if (!nuovo) return;
    nuovo.addEventListener('statechange', () => {
      if (nuovo.state !== 'installed') return;
      if (navigator.serviceWorker.controller) proponiAggiornamento(t, nuovo);
      else avviso({ text: t('pwa.ready'), timeout: 5000, closeLabel: t('nav.close') });
    });
  });

  // Ricontrolla tornando sull'app: chi la tiene aperta per giorni altrimenti
  // resterebbe indietro.
  let ultimo = Date.now();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - ultimo < 30 * 60 * 1000) return;
    ultimo = Date.now();
    registrazione.update().catch(() => { /* offline: pazienza */ });
  });
}

function proponiAggiornamento(t, worker) {
  avviso({
    text: t('pwa.updateReady'),
    action: t('pwa.updateAction'),
    closeLabel: t('nav.close'),
    onAction: () => {
      ricaricaAttesa = true;
      worker.postMessage({ type: 'SKIP_WAITING' });
    }
  });
}

/* ---------- foto in sottofondo ---------- */

/**
 * Le pagine e i dati sono già salvati; le foto pesano 6 MB e si scaricano
 * dopo, quando la pagina ha finito. Su connessione a consumo si lascia perdere:
 * arriveranno da sé man mano che le ricette vengono aperte.
 */
function prefetchFoto() {
  const rete = navigator.connection;
  if (rete?.saveData) return;
  if (rete?.effectiveType && /2g/.test(rete.effectiveType)) return;

  // Non `controller`: alla primissima visita non c'è ancora e il messaggio
  // andrebbe perso proprio quando serve, cioè quando la cache è vuota.
  const manda = () =>
    navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ type: 'PREFETCH_MEDIA' }));
  if ('requestIdleCallback' in window) requestIdleCallback(manda, { timeout: 5000 });
  else setTimeout(manda, 3000);
}

/* ---------- versione visibile in fondo ---------- */

function versioneInPiede() {
  const piede = document.querySelector('.sitefoot .wrap');
  if (!piede) return;
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type !== 'VERSION') return;
    const testo = `v${event.data.version.slice(0, 8)}`;
    const esistente = piede.querySelector('[data-version]');
    if (esistente) esistente.textContent = testo;
    else piede.append(el('span', { class: 'sitefoot__version', 'data-version': true, text: testo }));
  });
  // `ready` copre anche la primissima visita, quando il controller non c'è ancora
  navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ type: 'VERSION' }));
}

/* ---------- online / offline ---------- */

function statoRete(t) {
  const dipingi = () => document.documentElement.classList.toggle('is-offline', !navigator.onLine);
  dipingi();

  window.addEventListener('offline', () => {
    dipingi();
    avviso({ text: t('pwa.offline'), timeout: 6000, closeLabel: t('nav.close') });
  });
  window.addEventListener('online', () => {
    dipingi();
    avviso({ text: t('pwa.online'), timeout: 3000, closeLabel: t('nav.close') });
  });
}
