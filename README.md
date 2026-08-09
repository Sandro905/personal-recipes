# Quaderno di cucina

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
| `npm run build` | Rigenera l'indice **e** valida tutto. Da lanciare prima di pubblicare |
| `npm run new -- "Titolo ricetta"` | Crea `data/recipes/<slug>.json` già impostato |
| `npm run check` | Solo validazione (esce con errore se qualcosa non torna) |
| `node scripts/import-food.mjs …` | Importa un alimento da USDA o Open Food Facts |

Node 20+ solo per gli script di manutenzione. Il **sito** è HTML/CSS/JS puro: nessuna build, nessun bundler.

---

## Struttura

```
index.html            elenco ricette
ricetta.html          dettaglio (?r=slug&lang=it)
assets/css/style.css  tutto lo stile
assets/js/
  home.js             pagina elenco
  recipe.js           pagina ricetta
  lib/units.js        conversioni unità → grammi
  lib/nutrition.js    calcolo macro           ← condivisi con gli script Node
  lib/i18n.js         lingue e fallback
  lib/data.js         caricamento dati, formattazione, tema
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

`build` fa due cose: ricalcola `index.json` (titoli, tag, tempi, kcal/porzione, testo
cercabile) e valida. Se un ingrediente non esiste in `foods.json`, la validazione lo dice
e si ferma — così non ti ritrovi macro sbagliate in silenzio.

### Schema di una ricetta

```jsonc
{
  "slug": "focaccia-padella-prosciutto",   // deve combaciare col nome del file
  "added": "2026-08-09",                   // ordina l'elenco "più recenti"
  "title":   { "it": "…" },                // ogni testo è un oggetto per lingua
  "summary": { "it": "…" },
  "image": "assets/img/recipes/focaccia-padella-prosciutto.jpg",  // opzionale, foto di copertina
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
          git commit -am "rigenera indice" || echo "niente da committare"
          git push
```

**Netlify / Cloudflare Pages** — build command `npm run build`, publish directory `.`.

Per tenerlo privato: repo privato + Cloudflare Access, oppure una cartella protetta da
password sul tuo hosting. Il sito non ha backend, quindi non c'è niente da mettere in sicurezza
oltre all'accesso ai file.

---

## Note sul design

Palette e tipografia sono in cima a `style.css` come variabili CSS: cambiando `--saffron`,
`--basil` e `--wine` cambi accento e colori delle macro in tutto il sito. Tema chiaro/scuro
automatico dal sistema, con interruttore che sovrascrive e si ricorda. La stampa è già
impostata: `Stampa` produce una pagina pulita senza barre né timer.

Le spunte sugli ingredienti e le preferenze (lingua, tema) stanno in `localStorage`, quindi
sono per browser e non richiedono account.
