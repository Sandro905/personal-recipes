/* ---------------------------------------------------------------------------
   Corpo del service worker. Questo file NON gira così com'è: build-sw.mjs gli
   incolla davanti VERSION, SHELL e MEDIA e scrive il risultato in sw.js.
   Modificare qui, poi `npm run build`.
   --------------------------------------------------------------------------- */

const GUSCIO = `ricette-guscio-${VERSION}`;
const FOTO = 'ricette-foto';
// Cache minuscola che sopravvive agli aggiornamenti: ci sta solo l'impronta del
// codice dell'ultima versione attivata, per capire se questa porta davvero
// qualcosa da ricaricare.
const STATO = 'ricette-stato';

const abs = (path) => new URL(path, self.location.href).href;
/** Chiave di ricerca in cache: stesso indirizzo, senza "?..." né "#..." */
const chiave = (url) => url.origin + url.pathname;

const SHELL_URLS = new Set(SHELL.map(abs));
const FOTO_URLS = new Map(Object.entries(MEDIA).map(([path, hash]) => [abs(path), hash]));
const MANIFESTO = abs('./__foto-salvate__');
const IMPRONTA_CODICE = abs('./__codice-attivo__');

// I dati (elenco ricette, singole ricette, alimenti, testi) hanno una vita
// diversa dal codice: una ricetta nuova deve comparire appena è pubblicata,
// senza aspettare che si accetti l'aggiornamento del service worker. Per questi
// si chiede prima alla rete e si ricade sulla copia salvata, che resta lì per
// quando la rete non c'è.
const DATI_URLS = new Set(SHELL.filter((path) => path.startsWith('./data/')).map(abs));
const ATTESA_RETE = 3000;

const offline = () => new Response('', { status: 504, statusText: 'offline' });

/* --- installazione: si salva il guscio, tutto o niente --------------------- */

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(GUSCIO);
    // 'reload' scavalca la cache HTTP: mai installare una versione con dentro
    // un file vecchio rimasto in circolo.
    await cache.addAll(SHELL.map((path) => new Request(path, { cache: 'reload' })));

    // Se il codice del sito è identico a quello già attivo, questa versione
    // porta solo dati nuovi: non c'è niente da ricaricare, quindi si subentra
    // subito e in silenzio invece di disturbare con l'avviso.
    if (await codiceInvariato()) await self.skipWaiting();
  })());
});

/** L'impronta del codice combacia con quella dell'ultima versione attivata? */
async function codiceInvariato() {
  try {
    const risposta = await (await caches.open(STATO)).match(IMPRONTA_CODICE);
    return risposta ? (await risposta.text()) === CODICE : false;
  } catch {
    return false; // al dubbio si chiede, non si decide da soli
  }
}

/* --- attivazione: si buttano le versioni vecchie -------------------------- */

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const nomi = await caches.keys();
    const tenere = new Set([GUSCIO, FOTO, STATO]);
    await Promise.all(
      nomi.filter((nome) => nome.startsWith('ricette-') && !tenere.has(nome))
        .map((nome) => caches.delete(nome))
    );
    await allineaFoto();
    // Da qui in poi il codice attivo è questo: lo si registra per il confronto
    // alla prossima installazione.
    await (await caches.open(STATO)).put(IMPRONTA_CODICE, new Response(CODICE));
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
  if (DATI_URLS.has(key)) { event.respondWith(datiFreschi(richiesta, key)); return; }
  if (SHELL_URLS.has(key)) { event.respondWith(dallaCache(richiesta, key, GUSCIO)); return; }
  event.respondWith(reteQuindiCache(richiesta));
});

/**
 * Dati: prima la rete, con tre secondi di pazienza, poi la copia salvata.
 * Così una ricetta appena pubblicata si vede subito, mentre senza rete (o con
 * una rete che non risponde) il sito resta consultabile com'era.
 * Ogni risposta buona aggiorna la copia salvata.
 */
async function datiFreschi(richiesta, key) {
  const cache = await caches.open(GUSCIO);

  const daRete = (async () => {
    const risposta = await fetch(richiesta);
    if (!risposta.ok) throw new Error(String(risposta.status));
    await cache.put(key, risposta.clone());
    return risposta;
  })();

  const scaduta = new Promise((_, ko) => setTimeout(() => ko(new Error('lenta')), ATTESA_RETE));

  try {
    return await Promise.race([daRete, scaduta]);
  } catch {
    // La rete manca o tarda: si serve la copia salvata. Se la richiesta era
    // solo lenta continua per conto suo e aggiorna la cache per la prossima.
    daRete.catch(() => { /* offline: niente da aggiornare */ });
    return (await cache.match(key)) ?? daRete.catch(() => offline());
  }
}

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
