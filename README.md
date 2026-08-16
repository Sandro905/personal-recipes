# Ricette personali

Ricettario personale, sito statico, zero dipendenze da installare. Le grammature si
ricalcolano al variare delle porzioni e le macro vengono calcolate dagli ingredienti
tramite un database locale di alimenti.

Aggiungere una ricetta = creare un file JSON e rilanciare un comando.

---

## Avvio in locale

```bash
npm start          # server su http://localhost:8080  (è solo python3 -m http.server)
```

Serve un server: aprendo `index.html` con doppio clic il browser blocca `fetch()` dei
file JSON. Qualunque server statico va bene (`npx serve`, `php -S`, estensione Live Server…).

## Comandi

| Comando | Cosa fa |
|---|---|
| `npm start` | Server locale di anteprima |
| `npm run build` | Rigenera l'indice, valida tutto **e** rigenera `sw.js`. Da lanciare prima di pubblicare |
| `npm run new -- "Titolo ricetta"` | Crea `data/recipes/<slug>.json` già impostato |
| `npm run check` | Solo validazione (esce con errore se qualcosa non torna) |
| `npm run sw` | Solo rigenerazione del service worker |
| `node scripts/import-food.mjs …` | Importa un alimento da USDA o Open Food Facts |

Node 20+ solo per gli script di manutenzione. Il **sito** è HTML/CSS/JS puro: nessuna build, nessun bundler.

---

## Struttura

```
index.html            elenco ricette
ricetta.html          dettaglio (?r=slug&lang=it)
alimenti.html         database alimenti, macro per 100 g, con ricerca e filtri
assets/css/style.css  design system completo (token, componenti, pagine)
assets/js/
  home.js             pagina elenco
  recipe.js           pagina ricetta
  foods.js            pagina alimenti
  lib/units.js        conversioni unità → grammi
  lib/nutrition.js    calcolo macro           ← condivisi con gli script Node
  lib/i18n.js         lingue e fallback
  lib/data.js         caricamento dati, formattazione, tema
  lib/nav.js          barra, menu a scomparsa, icone SVG
  lib/pwa.js          copia locale: registrazione, avviso di aggiornamento
  fonts/              Inter (SIL OFL), servito dal sito e non da un CDN
  icons/              icone dell'app per la schermata home
sw.js                 GENERATO — service worker, vedi "Copia locale e offline"
manifest.webmanifest  scheda dell'app (nome, icone, colori)
data/
  foods.json          database alimenti (macro per 100 g)
  recipes/*.json      una ricetta per file
  recipes/index.json  GENERATO — non modificarlo a mano
  i18n/it.json        testi dell'interfaccia
  i18n/en.json        idem, per il futuro
scripts/              manutenzione
```

`lib/units.js` e `lib/nutrition.js` girano identici nel browser e in Node: le kcal
mostrate nell'elenco e quelle calcolate nella pagina ricetta vengono dallo stesso codice.

---

## Aggiungere una ricetta

```bash
npm run new -- "Torta all'acqua al cacao"
# compila data/recipes/torta-allacqua-al-cacao.json
npm run build
```

`build` fa tre cose: ricalcola `index.json` (titoli, tag, tempi, kcal/porzione, testo
cercabile), valida e rigenera `sw.js`. Se un ingrediente non esiste in `foods.json`, la validazione lo dice
e si ferma — così non ti ritrovi macro sbagliate in silenzio.

### Schema di una ricetta

```jsonc
{
  "slug": "focaccia-padella-prosciutto",   // deve combaciare col nome del file
  "added": "2026-08-09",                   // ordina l'elenco "più recenti"
  "title":   { "it": "…" },                // ogni testo è un oggetto per lingua
  "summary": { "it": "…" },
  "image": "assets/img/recipes/focaccia-padella-prosciutto.jpg",  // opzionale, foto di copertina
  "imageFocus": "center 72%",              // opzionale, object-position CSS per ritagli stretti (card, hero)
  "gallery": [                             // opzionale, foto del procedimento (in fondo alla pagina)
    { "image": "assets/img/recipes/focaccia-padella-prosciutto-passaggi-1.jpg",
      "caption": { "it": "…" } }
  ],
  "yield":   { "count": 2, "label": { "it": "persone" } },
  "time":    { "prep": 20, "rest": 20, "cook": 28 },   // minuti
  "difficulty": "molto-facile",            // chiavi definite in data/i18n/it.json
  "cost": "molto-economico",
  "method": "padella",
  "tags": ["salato", "lievitati"],
  "source": { "name": "…", "url": "…" },

  "ingredients": [
    { "section": { "it": "Per l'impasto" },   // section: null se non serve titolo
      "items": [
        { "food": "farina-0", "qty": 440, "unit": "g" },
        { "food": "mozzarella", "qty": 100, "unit": "g",
          "label": { "it": "mozzarella, ben sgocciolata" },  // sovrascrive il nome
          "note":  { "it": "riga di dettaglio sotto l'ingrediente" } }
      ] }
  ],

  "steps": [
    { "title": { "it": "Impastare" },
      "text":  { "it": "Mescola {{farina-0}} con {{acqua}}…" },
      "timer": 1200 }                       // secondi, opzionale
  ],

  "notes": [ { "title": { "it": "Conservazione" }, "text": { "it": "…**grassetto**…" } } ]
}
```

**Segnaposto nei passaggi.** `{{farina-0}}` diventa "440 g di farina 0" e si ricalcola
quando cambi le porzioni. Se lo stesso alimento compare più volte tra gli ingredienti
(es. olio nell'impasto e olio in padella), usa `{{olio-oliva-evo#2}}` per la seconda
occorrenza. La validazione controlla che ogni segnaposto esista.

**Unità ammesse:** `g` `hg` `kg` `mg` · `ml` `cl` `dl` `l` · `cucchiaio` `cucchiaino`
`bicchiere` `tazza` · `pz` (usa `pieceWeight` dell'alimento) · `qb` (quanto basta, esclusa
dalle macro) · le unità specifiche dell'alimento (`bustina`, `spicchio`, `cubetto`).

---

## Il database alimenti

`data/foods.json`, una voce per alimento:

```jsonc
"patate": {
  "name": { "it": "patate", "en": "potatoes" },
  "category": "verdure",
  "per100g": { "kcal": 77, "protein": 2, "carbs": 17, "fat": 0.1,
               "fiber": 2.2, "sugars": 0.8, "salt": 0 },
  "density": 0.6,        // g per ml → serve per cucchiai, ml, tazze
  "pieceWeight": 150,    // g per pezzo → serve per "pz"
  "units": { "spicchio": 5 },   // unità proprie dell'alimento, in grammi
  "source": { "db": "manual" }
}
```

I ~58 alimenti di partenza sono valori medi da tabelle di composizione ed etichette:
buoni per farsi un'idea, non certificati. Per un prodotto che usi spesso, sostituiscili
con i numeri della tua etichetta.

### Importare da un database esterno

```bash
# ingrediente generico → USDA FoodData Central (pubblico dominio, chiave gratuita)
FDC_API_KEY=xxxx node scripts/import-food.mjs usda "potato raw" \
  --id patate --name-it patate --category verdure --piece 150

# prodotto confezionato → Open Food Facts, con il codice a barre
node scripts/import-food.mjs off 80176392 \
  --id passata-pomodoro --name-it "passata di pomodoro" --density 1.05

# provare senza scrivere
… --dry-run
```

Lo script normalizza i valori a 100 g, converte il sodio in sale (`× 2,5`) e registra la
fonte nel campo `source`. Chiave USDA: `fdc.nal.usda.gov/api-key-signup.html`.
Open Food Facts è sotto licenza ODbL: per uso personale nessun problema, se un domani
pubblichi il database va citata la fonte (che resta salvata in `source`).

> Le due chiamate di rete non sono state provate dall'ambiente in cui il progetto è stato
> generato: al primo uso controlla l'output prima di fidarti dei numeri.

### Come vengono calcolate le macro

1. ogni ingrediente viene convertito in grammi (`units.js`);
2. grammi ÷ 100 × valori dell'alimento, sommati (`nutrition.js`);
3. per porzione = totale ÷ `yield.count`.

Sono stime **sugli ingredienti crudi**: non tengono conto dell'acqua persa in cottura,
dell'olio assorbito friggendo o degli scarti. Gli ingredienti `qb` e quelli senza dati
restano fuori dal totale e vengono elencati nel pannello "Da sapere sul calcolo", così
sai sempre cosa manca.

---

## Aggiungere una lingua

1. copia `data/i18n/it.json` in `data/i18n/xx.json` e traduci i testi dell'interfaccia;
2. aggiungi `'xx'` a `LANGS` in `assets/js/lib/i18n.js`;
3. nelle ricette aggiungi la chiave accanto a quella italiana:
   `"title": { "it": "Focaccia…", "xx": "…" }`;
4. `npm run build`.

Non serve tradurre tutto in una volta: `tr()` ricade sull'italiano campo per campo, e la
validazione elenca come *avviso* le traduzioni mancanti. La lingua si sceglie dal
selettore in alto, si ricorda nel browser e si può forzare con `?lang=en`.

---

## Pubblicare

Sito interamente statico: qualunque hosting va bene.

**GitHub Pages** — push del repo, poi Settings → Pages → branch `main`, cartella `/`.
Se vuoi che l'indice si rigeneri da solo a ogni push, aggiungi
`.github/workflows/build.yml`:

```yaml
name: build
on: { push: { branches: [main] } }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm run build
      - run: |
          git config user.name github-actions
          git config user.email actions@github.com
          git commit -am "rigenera indice e service worker" || echo "niente da committare"
          git push
```

**Netlify / Cloudflare Pages** — build command `npm run build`, publish directory `.`.

Per tenerlo privato: repo privato + Cloudflare Access, oppure una cartella protetta da
password sul tuo hosting. Il sito non ha backend, quindi non c'è niente da mettere in sicurezza
oltre all'accesso ai file.

---

## Copia locale e offline

Alla prima visita il sito si salva nel browser e da lì in poi si apre da lì: le pagine
compaiono subito, senza attendere la rete, e continuano a funzionare quando la rete non
c'è. Su telefono si può aggiungere alla schermata home ("Installa app" / "Aggiungi a
Home") e si apre a schermo intero come un'applicazione.

A gestirlo è `sw.js`, un **service worker**. Non si scrive a mano: lo genera
`scripts/build-sw.mjs` unendo l'elenco dei file al corpo `scripts/sw-runtime.js`.
**Le modifiche vanno fatte in `scripts/sw-runtime.js`**, poi `npm run build`.

### Come funziona l'aggiornamento

Il numero di versione è l'**impronta del contenuto**: `sha256` di tutti i file del sito,
troncato. Cambia se e solo se cambia davvero qualcosa — non c'è nessun numero da
incrementare a mano e non ci si può dimenticare di farlo.

1. il browser riscarica `sw.js` a ogni visita (`updateViaCache: 'none'`, quindi mai dalla
   cache HTTP);
2. se i byte sono diversi installa la nuova copia **accanto** a quella vecchia, senza
   toccarla: chi sta leggendo una ricetta non si vede cambiare la pagina sotto le dita;
3. a installazione finita compare in basso *"Nuova versione disponibile · Aggiorna"*;
4. premendo **Aggiorna** la nuova copia prende il posto della vecchia, le cache
   precedenti vengono cancellate e la pagina si ricarica.

Chi non preme niente resta sulla versione salvata e la trova aggiornata alla riapertura
successiva. La versione attiva è scritta in fondo a ogni pagina (`v` + 8 cifre): serve a
capire a colpo d'occhio se quello che si sta guardando è l'ultimo.

### Due cache, perché

| cache | contenuto | vita |
|---|---|---|
| `ricette-guscio-<versione>` | HTML, CSS, JS, font, icone e i dati (~505 KB) | si rifà a ogni versione |
| `ricette-foto` | le foto delle ricette (~6,2 MB) | sopravvive agli aggiornamenti |

Il guscio si salva tutto insieme all'installazione: se manca un pezzo l'installazione
fallisce e resta attiva la versione precedente, mai una copia a metà. Le foto pesano
dieci volte tanto e cambiano di rado, perciò stanno a parte: a ogni aggiornamento si
confrontano le impronte e si riscarica **solo** ciò che è cambiato davvero. Correggere
una virgola in una ricetta costa qualche decina di KB, non 6 MB.

Le foto non bloccano nulla: si scaricano in sottofondo a pagina caricata, così dopo la
prima visita anche le ricette mai aperte hanno la loro immagine offline. Su connessione
a consumo (`saveData`, 2G) il precaricamento si salta e le foto arrivano man mano che le
ricette vengono aperte.

### I dati non aspettano l'aggiornamento

Codice e dati stanno nella stessa cache ma hanno regole diverse.

- **Guscio** (HTML, CSS, JS, font, icone): sempre dalla copia salvata. È quello che rende
  l'apertura istantanea, e cambia solo quando si accetta la nuova versione.
- **Dati** (`data/**`: elenco ricette, singole ricette, alimenti, testi): **prima la rete**,
  con tre secondi di pazienza, poi la copia salvata. Ogni risposta buona aggiorna la copia.

Serve a questo: una ricetta appena pubblicata si vede al primo ricaricamento, senza dover
premere "Aggiorna" e senza aspettare che il service worker si sostituisca. Senza rete, o
con una rete che non risponde entro i tre secondi, si ricade sulla copia salvata e il sito
resta consultabile esattamente com'era.

Prima non era così: i dati arrivavano dalla cache come tutto il resto, e chi non toccava
l'avviso di aggiornamento continuava a non vedere le ricette nuove.

### In sviluppo

Il service worker gira solo su `https` e su `localhost` — con `npm start` è attivo, e una
copia salvata può nascondere le modifiche appena fatte. In DevTools → Application →
Service Workers ci sono *Update on reload* e *Bypass for network*; in alternativa
`npm run build` cambia la versione e fa comparire l'avviso di aggiornamento.

---

## Note sul design

`style.css` è organizzato come un design system: in cima i **token** (colori, scala
tipografica, spaziature, raggi, ombre) come variabili CSS, sotto i **componenti**
(`.btn`, `.field`, `.chip`, `.segmented`, `.card`, `.panel`…), infine le sezioni di
pagina. Per cambiare l'accento di tutto il sito basta `--accent`; per i colori delle
macro `--protein`, `--carbs`, `--fat`.

Un solo carattere, **Inter**, servito dal sito stesso (`assets/fonts/`, un file
variabile per sottoinsieme, 134 KB in tutto) e non da un CDN: la tipografia resta la
stessa anche senza rete, e non c'è una richiesta a terzi a bloccare il primo disegno.
Resta il fallback al font di sistema.

**Mobile first**: le regole base sono quelle del telefono, i breakpoint (`min-width`)
aggiungono soltanto. Da 768px in su i link di navigazione tornano in barra e il menu
a scomparsa sparisce; sotto, si apre dall'hamburger.

Tema chiaro/scuro automatico dal sistema, con interruttore che sovrascrive e si
ricorda. La stampa è già impostata: `Stampa` produce una pagina pulita senza barre,
menu, timer né foto.

Le spunte sugli ingredienti e le preferenze (lingua, tema) stanno in `localStorage`,
quindi sono per browser e non richiedono account.
