// GENERATO da scripts/build-sw.mjs — non modificarlo a mano.
// Sorgente: scripts/sw-runtime.js · rigenera con `npm run build`.

const VERSION = 'a1d110aa75';
const CODICE = '420ec0ffff';

// Guscio: HTML, stile, codice, font, icone e dati. ~543 KB,
// salvato tutto insieme all'installazione. Se manca un pezzo l'installazione
// fallisce e resta attiva la versione precedente: mai una copia a metà.
const SHELL = [
  './index.html',
  './ricetta.html',
  './alimenti.html',
  './manifest.webmanifest',
  './assets/css/style.css',
  './assets/js/foods.js',
  './assets/js/home.js',
  './assets/js/lib/data.js',
  './assets/js/lib/i18n.js',
  './assets/js/lib/nav.js',
  './assets/js/lib/nutrition.js',
  './assets/js/lib/pwa.js',
  './assets/js/lib/units.js',
  './assets/js/recipe.js',
  './assets/fonts/inter-latin-ext.woff2',
  './assets/fonts/inter-latin.woff2',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './data/foods.json',
  './data/i18n/en.json',
  './data/i18n/it.json',
  './data/recipes/alette-pollo-forno-patate.json',
  './data/recipes/bistecca-patate-forno.json',
  './data/recipes/calzoni-prosciutto-mozzarella.json',
  './data/recipes/carbonara-semplificata.json',
  './data/recipes/cosce-pollo-croccanti-friggitrice.json',
  './data/recipes/crocchette-patate-friggitrice.json',
  './data/recipes/focaccia-padella-prosciutto.json',
  './data/recipes/frittata-pane-pomodoro.json',
  './data/recipes/fusi-pollo-forno-patate.json',
  './data/recipes/gnocchi-sorrentina-friggitrice.json',
  './data/recipes/hot-pocket-manzo.json',
  './data/recipes/index.json',
  './data/recipes/involtini-manzo-prosciutto.json',
  './data/recipes/lasagna-ragu-manzo.json',
  './data/recipes/merluzzo-forno-patate.json',
  './data/recipes/mousse-proteica-cioccolato.json',
  './data/recipes/pasta-pesce-spada-pomodorini.json',
  './data/recipes/pasta-ragu-pollo.json',
  './data/recipes/pasta-salmone-affumicato.json',
  './data/recipes/pasta-salsiccia-funghi.json',
  './data/recipes/pasta-straccetti-manzo-funghi.json',
  './data/recipes/pasta-sugo-costine.json',
  './data/recipes/pasta-tonno-pomodorini.json',
  './data/recipes/pizza-tortilla-cotto.json',
  './data/recipes/pizzette-yogurt-cotto.json',
  './data/recipes/pollo-cacciatora-patate.json',
  './data/recipes/polpette-pollo-forno.json',
  './data/recipes/polpette-tonno-patate-friggitrice.json',
  './data/recipes/risotto-gamberetti-limone.json',
  './data/recipes/salmone-cartoccio-insalata.json',
  './data/recipes/salmone-forno-patate-peperoni.json',
  './data/recipes/spezzatino-manzo-patate.json',
  './data/recipes/spezzatino-pollo-riso.json',
  './data/recipes/tortilla-frittata-cotto.json',
  './data/recipes/wrap-pollo-speziato.json'
];

// Foto: ~6.9 MB. Stanno in una cache a parte che sopravvive
// agli aggiornamenti; l'impronta dice quali sono davvero cambiate.
const MEDIA = {
  './assets/img/recipes/alette-pollo-forno-patate.jpg': '586e1eb542785521',
  './assets/img/recipes/bistecca-patate-forno.jpg': 'd9df1a2850754899',
  './assets/img/recipes/calzoni-prosciutto-mozzarella.jpg': '6d5468ecb817275a',
  './assets/img/recipes/carbonara-semplificata.jpg': 'e94ffc84c285d9a4',
  './assets/img/recipes/cosce-pollo-croccanti-friggitrice.jpg': 'b7f121df82e665cf',
  './assets/img/recipes/crocchette-patate-friggitrice.jpg': '9ad36059452dbf2a',
  './assets/img/recipes/focaccia-padella-prosciutto-passaggi-1.jpg': 'f2097e70303ec703',
  './assets/img/recipes/focaccia-padella-prosciutto-passaggi-2.jpg': '0e70e9fbdb8ea23b',
  './assets/img/recipes/focaccia-padella-prosciutto.jpg': 'bae95ccd2067706f',
  './assets/img/recipes/frittata-pane-pomodoro.jpg': '96b10453bc9d1451',
  './assets/img/recipes/fusi-pollo-forno-patate.jpg': 'e5933714e11fb092',
  './assets/img/recipes/gnocchi-sorrentina-friggitrice.jpg': 'b1cd809aaa49e9e8',
  './assets/img/recipes/hot-pocket-manzo.jpg': '459710e4207265df',
  './assets/img/recipes/involtini-manzo-prosciutto.jpg': 'a8b86eb0c4efa10e',
  './assets/img/recipes/lasagna-ragu-manzo.jpg': '97338bc1c8462c64',
  './assets/img/recipes/merluzzo-forno-patate.jpg': 'd7171a2f95c50ca9',
  './assets/img/recipes/mousse-proteica-cioccolato.jpg': '5bea0a180d48d562',
  './assets/img/recipes/pasta-pesce-spada-pomodorini.jpg': '7340d54a855a3b83',
  './assets/img/recipes/pasta-ragu-pollo.jpg': 'ffe84e11e4f1c49c',
  './assets/img/recipes/pasta-salmone-affumicato.jpg': '517f24c6317e515c',
  './assets/img/recipes/pasta-salsiccia-funghi.jpg': '498c4f9022733341',
  './assets/img/recipes/pasta-straccetti-manzo-funghi.jpg': 'fb5279c9a76cf042',
  './assets/img/recipes/pasta-sugo-costine.jpg': '14473c482ebe21c4',
  './assets/img/recipes/pasta-tonno-pomodorini.jpg': '8ca36a6a967e123d',
  './assets/img/recipes/pizza-tortilla-cotto.jpg': 'e721b71096de3917',
  './assets/img/recipes/pizzette-yogurt-cotto.jpg': '9db27ced55396064',
  './assets/img/recipes/pollo-cacciatora-patate.jpg': 'b8894d645cb71205',
  './assets/img/recipes/polpette-pollo-forno.jpg': '64968459a9cf5ca9',
  './assets/img/recipes/polpette-tonno-patate-friggitrice-passaggi-1.jpg': '544294e4054cf294',
  './assets/img/recipes/polpette-tonno-patate-friggitrice-passaggi-2.jpg': 'e913469a1887eda1',
  './assets/img/recipes/polpette-tonno-patate-friggitrice-passaggi-3.jpg': '1aeada42cf3dda73',
  './assets/img/recipes/polpette-tonno-patate-friggitrice.jpg': '0a64bba7e95b4681',
  './assets/img/recipes/risotto-gamberetti-limone.jpg': '66e5951b40300680',
  './assets/img/recipes/salmone-cartoccio-insalata.jpg': '04c744ac27efebaf',
  './assets/img/recipes/salmone-forno-patate-peperoni-passaggi-1.jpg': '31d45278048a2054',
  './assets/img/recipes/salmone-forno-patate-peperoni-passaggi-2.jpg': '15ff1e98cd376ef0',
  './assets/img/recipes/salmone-forno-patate-peperoni.jpg': 'ea7443abf28a1fc1',
  './assets/img/recipes/spezzatino-manzo-patate.jpg': '15b61173413eb5f4',
  './assets/img/recipes/spezzatino-pollo-riso.jpg': 'b3df629f5a6573ff',
  './assets/img/recipes/tortilla-frittata-cotto.jpg': 'c0556ca85b23ed2a',
  './assets/img/recipes/wrap-pollo-speziato.jpg': 'b4bf7f68ccb39ae4'
};

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
