#!/usr/bin/env node
// Rigenera sw.js con l'elenco dei file da salvare e un numero di versione.
//
// La versione è l'impronta del contenuto del sito: cambia se e solo se cambia
// un file. È questo che fa scattare l'aggiornamento sul telefono — il browser
// riscarica sw.js a ogni visita e, se i byte sono diversi, installa la nuova
// copia. Nessun numero da incrementare a mano.
//
// Due elenchi separati, perché hanno vite diverse:
//   guscio  html, css, js, font, icone, dati  →  ~500 KB, si riscarica intero
//   foto    assets/img/**                     →  ~6 MB, si riusa fra versioni

import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const SHELL_DIRS = ['assets/css', 'assets/js', 'assets/fonts', 'assets/icons', 'data'];
const SHELL_ROOT_FILES = ['index.html', 'ricetta.html', 'alimenti.html', 'manifest.webmanifest'];
const MEDIA_DIRS = ['assets/img'];
const SKIP = new Set(['.DS_Store', 'LICENSE.txt']);

async function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = await readdir(join(root, dir), { withFileTypes: true });
  } catch {
    return out; // cartella non ancora creata: nessun file da salvare
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name.startsWith('.') || SKIP.has(entry.name)) continue;
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...(await walk(path)));
    else out.push(path);
  }
  return out;
}

/** [{ path, hash }] con l'impronta di ogni file. */
async function fingerprint(paths) {
  return Promise.all(
    paths.map(async (path) => ({
      path,
      hash: createHash('sha256').update(await readFile(join(root, path))).digest('hex').slice(0, 16)
    }))
  );
}

const shell = await fingerprint([
  ...SHELL_ROOT_FILES,
  ...(await Promise.all(SHELL_DIRS.map(walk))).flat()
]);
const media = await fingerprint((await Promise.all(MEDIA_DIRS.map(walk))).flat());

// La versione copre guscio + foto: cambiare una foto deve invalidare la copia
// salvata, altrimenti il telefono continua a mostrare quella vecchia.
const version = createHash('sha256')
  .update([...shell, ...media].map((f) => `${f.path}:${f.hash}`).join('\n'))
  .digest('hex')
  .slice(0, 10);

// Impronta del solo codice: HTML, stile, script, font, icone — i dati no.
// Serve a distinguere "è cambiato il sito" da "è stata aggiunta una ricetta".
// Nel primo caso la pagina va ricaricata e si chiede all'utente; nel secondo
// non c'è niente da ricaricare e il service worker subentra in silenzio.
const codice = createHash('sha256')
  .update(shell.filter((f) => !f.path.startsWith('data/')).map((f) => `${f.path}:${f.hash}`).join('\n'))
  .digest('hex')
  .slice(0, 10);

const bytes = async (files) =>
  (await Promise.all(files.map(async (f) => (await readFile(join(root, f.path))).length)))
    .reduce((a, b) => a + b, 0);

const shellBytes = await bytes(shell);
const mediaBytes = await bytes(media);

const list = (files) => files.map((f) => `  './${f.path}'`).join(',\n');
const map = (files) => files.map((f) => `  './${f.path}': '${f.hash}'`).join(',\n');

const source = `// GENERATO da scripts/build-sw.mjs — non modificarlo a mano.
// Sorgente: scripts/sw-runtime.js · rigenera con \`npm run build\`.

const VERSION = '${version}';
const CODICE = '${codice}';

// Guscio: HTML, stile, codice, font, icone e dati. ~${Math.round(shellBytes / 1024)} KB,
// salvato tutto insieme all'installazione. Se manca un pezzo l'installazione
// fallisce e resta attiva la versione precedente: mai una copia a metà.
const SHELL = [
${list(shell)}
];

// Foto: ~${Math.round(mediaBytes / 1024 / 1024 * 10) / 10} MB. Stanno in una cache a parte che sopravvive
// agli aggiornamenti; l'impronta dice quali sono davvero cambiate.
const MEDIA = {
${map(media)}
};

${await readFile(join(root, 'scripts', 'sw-runtime.js'), 'utf8')}`;

await writeFile(join(root, 'sw.js'), source, 'utf8');

console.log(
  `sw.js aggiornato · versione ${version} · ` +
  `${shell.length} file di guscio (${Math.round(shellBytes / 1024)} KB) + ` +
  `${media.length} foto (${Math.round(mediaBytes / 1024 / 1024 * 10) / 10} MB)`
);
