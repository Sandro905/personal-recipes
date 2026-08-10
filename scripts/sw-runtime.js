/* ---------------------------------------------------------------------------
   Corpo del service worker. Questo file NON gira così com'è: build-sw.mjs gli
   incolla davanti VERSION, SHELL e MEDIA e scrive il risultato in sw.js.
   Modificare qui, poi `npm run build`.
   --------------------------------------------------------------------------- */

const GUSCIO = `ricette-guscio-${VERSION}`;
const FOTO = 'ricette-foto';

const abs = (path) => new URL(path, self.location.href).href;
/** Chiave di ricerca in cache: stesso indirizzo, senza "?..." né "#..." */
const chiave = (url) => url.origin + url.pathname;

const SHELL_URLS = new Set(SHELL.map(abs));
const FOTO_URLS = new Map(Object.entries(MEDIA).map(([path, hash]) => [abs(path), hash]));
const MANIFESTO = abs('./__foto-salvate__');

const offline = () => new Response('', { status: 504, statusText: 'offline' });

/* --- installazione: si salva il guscio, tutto o niente --------------------- */

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(GUSCIO).then((cache) =>
      // 'reload' scavalca la cache HTTP: mai installare una versione con
      // dentro un file vecchio rimasto in circolo.
      cache.addAll(SHELL.map((path) => new Request(path, { cache: 'reload' })))
    )
  );
});

/* --- attivazione: si buttano le versioni vecchie -------------------------- */

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const nomi = await caches.keys();
    await Promise.all(
      nomi
        .filter((nome) => nome.startsWith('ricette-') && nome !== GUSCIO && nome !== FOTO)
        .map((nome) => caches.delete(nome))
    );
    await allineaFoto();
    await self.clients.claim();
  })());
});

/**
 * Le foto vivono in una cache che sopravvive agli aggiornamenti, così cambiare
 * una virgola in una ricetta non costa 6 MB di riscaricamento. Il prezzo è
 * doverne controllare l'impronta: si butta solo ciò che è davvero cambiato o
 * che non esiste più.
 */
async function allineaFoto() {
  const cache = await caches.open(FOTO);
  let salvate = {};
  try {
    const risposta = await cache.match(MANIFESTO);
    if (risposta) salvate = await risposta.json();
  } catch { salvate = {}; }

  await Promise.all(
    Object.entries(salvate)
      .filter(([url, hash]) => FOTO_URLS.get(url) !== hash)
      .map(([url]) => cache.delete(url))
  );

  await cache.put(
    MANIFESTO,
    new Response(JSON.stringify(Object.fromEntries(FOTO_URLS)), {
      headers: { 'content-type': 'application/json' }
    })
  );
}

/* --- risposte -------------------------------------------------------------- */

self.addEventListener('fetch', (event) => {
  const richiesta = event.request;
  if (richiesta.method !== 'GET') return;

  const url = new URL(richiesta.url);
  if (url.origin !== self.location.origin) return; // niente di terzi

  if (richiesta.mode === 'navigate') {
    event.respondWith(rispondiPagina(richiesta, url));
    return;
  }

  const key = chiave(url);
  if (FOTO_URLS.has(key)) { event.respondWith(dallaCache(richiesta, key, FOTO)); return; }
  if (SHELL_URLS.has(key)) { event.respondWith(dallaCache(richiesta, key, GUSCIO)); return; }
  event.respondWith(reteQuindiCache(richiesta));
});

/**
 * Le pagine arrivano dalla copia salvata, sempre: è quello che rende
 * l'apertura istantanea e il sito consultabile senza rete. La freschezza non
 * dipende da questa richiesta ma dalla versione del service worker.
 */
async function rispondiPagina(richiesta, url) {
  const cache = await caches.open(GUSCIO);
  // "/" e "/cartella/" vogliono dire index.html
  const key = chiave(url).endsWith('/') ? `${chiave(url)}index.html` : chiave(url);
  const salvata = await cache.match(key);
  if (salvata) return salvata;
  try {
    return await fetch(richiesta);
  } catch {
    return (await cache.match(abs('./index.html'))) ?? offline();
  }
}

async function dallaCache(richiesta, key, nome) {
  const cache = await caches.open(nome);
  const salvata = await cache.match(key);
  if (salvata) return salvata;
  try {
    const risposta = await fetch(richiesta);
    if (risposta.ok) await cache.put(key, risposta.clone());
    return risposta;
  } catch {
    return offline();
  }
}

/** Tutto il resto (file nuovi non ancora in elenco): rete, poi copia salvata. */
async function reteQuindiCache(richiesta) {
  try {
    return await fetch(richiesta);
  } catch {
    return (await caches.match(chiave(new URL(richiesta.url)))) ?? offline();
  }
}

/* --- dialogo con le pagine ------------------------------------------------- */

self.addEventListener('message', (event) => {
  const tipo = event.data?.type;
  if (tipo === 'SKIP_WAITING') self.skipWaiting();
  if (tipo === 'PREFETCH_MEDIA') event.waitUntil(scaricaFotoMancanti());
  if (tipo === 'VERSION') event.source?.postMessage({ type: 'VERSION', version: VERSION });
});

/**
 * Riempimento delle foto in sottofondo, chiesto dalla pagina quando ha finito
 * di caricarsi. Poche alla volta per non rubare banda alla navigazione, e al
 * primo errore di rete si smette: si riprova alla visita successiva.
 */
async function scaricaFotoMancanti() {
  const cache = await caches.open(FOTO);
  const presenti = new Set((await cache.keys()).map((r) => r.url));
  const mancanti = [...FOTO_URLS.keys()].filter((url) => !presenti.has(url));
  if (!mancanti.length) return;

  let prossima = 0;
  const filo = async () => {
    while (prossima < mancanti.length) {
      const url = mancanti[prossima++];
      try {
        const risposta = await fetch(url, { cache: 'reload' });
        if (risposta.ok) await cache.put(url, risposta);
      } catch {
        return;
      }
    }
  };
  await Promise.all([filo(), filo(), filo()]);
}
