#!/usr/bin/env node
// genera_inventario.mjs — data/INVENTARIO.md, l'UNICO censimento dei dati (E24:
// mai più 8 gare da una parte e 10 dall'altra). Il documento è GENERATO dai
// file realmente su disco, in modo deterministico: la sentinella s02 lo
// rigenera e pretende che coincida col committato.
//
// Righe per gara = lunghezza della colonna `time` del file giri (colonnare).
// Se la colonna manca il conteggio è null ESPLICITO (regola 6), mai un numero
// plausibile.
//
// Uso: node provenienza/genera_inventario.mjs            → scrive data/INVENTARIO.md
//      node provenienza/genera_inventario.mjs --check [--file <p>]
//                                                        → confronta, esce 1 se diverge

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(radice, 'data');
const muori = (msg) => { console.error(`INVENTARIO: ${msg}`); process.exit(1); };

const righeDi = (p, gz) => {
  const buf = gz ? gunzipSync(readFileSync(p)) : readFileSync(p);
  const j = JSON.parse(buf);
  return Array.isArray(j.time) ? j.time.length : null;
};
const mostra = (n) => (n === null ? 'null (senza colonna `time`)' : String(n));

const R = [];
R.push('# INVENTARIO — l\'unico censimento dei dati (E24)');
R.push('');
R.push('GENERATO da `provenienza/genera_inventario.mjs`: non si modifica a mano, si');
R.push('rigenera; la sentinella `s02_inventario` lo confronta coi file reali.');
R.push('Fonte dell\'import: `tommyieri/muretto-box-virtuale` @');
R.push('`90d9a19c334eae84b806bd2f401c8ed4770a7169` (origin/main, 2026-07-29) — vedi');
R.push('`provenienza/importa_archivio.mjs`; integrità in `data/MANIFEST.sha256`.');
R.push('');

// ---- gare 2026 --------------------------------------------------------------
const dirArch = path.join(dataDir, 'gare_2026', 'ti_archive');
const dirCache = path.join(dataDir, 'gare_2026', 'ti_cache');
if (!existsSync(dirArch) || !existsSync(dirCache)) muori('data/gare_2026 assente: eseguire prima importa_archivio.mjs');
const gare = new Set([
  ...readdirSync(dirArch),
  ...readdirSync(dirCache).map((f) => f.replace(/\.json$/, '')),
]);
R.push(`## Gare 2026 (${gare.size})`);
R.push('');
R.push('Nome canonico italiano (rename E24 registrati in fondo al documento).');
R.push('Righe = giri-auto della gara; la fonte dei giri è indicata per gara.');
R.push('');
R.push('| gara | righe gara | fonte giri | sessioni in ti_archive |');
R.push('|---|---|---|---|');
for (const g of [...gare].sort()) {
  const cache = path.join(dirCache, `${g}.json`);
  const arch = path.join(dirArch, g);
  const sessioni = existsSync(arch) ? readdirSync(arch).sort().map((s) => s.replace(/\.json$/, '')) : [];
  let righe = null; let fonte = 'null (nessun file giri: assenza esplicita)';
  if (existsSync(cache)) { righe = righeDi(cache, false); fonte = 'ti_cache'; }
  else if (sessioni.includes('Race')) { righe = righeDi(path.join(arch, 'Race.json'), false); fonte = 'ti_archive/Race'; }
  R.push(`| ${g} | ${mostra(righe)} | ${fonte} | ${sessioni.join(', ') || '—'} |`);
}
R.push('');

// ---- fondo 2018–2025 --------------------------------------------------------
const dirFondo = path.join(dataDir, 'fondo');
if (!existsSync(dirFondo)) muori('data/fondo assente: eseguire prima importa_archivio.mjs');
const anni = readdirSync(dirFondo).filter((a) => /^\d{4}$/.test(a)).sort();
let totGare = 0;
const blocchi = [];
for (const anno of anni) {
  const gareAnno = readdirSync(path.join(dirFondo, anno)).sort();
  totGare += gareAnno.length;
  const B = [];
  B.push(`### ${anno} (${gareAnno.length} gare)`);
  B.push('');
  B.push('| gara | righe Race |');
  B.push('|---|---|');
  for (const g of gareAnno) {
    const race = path.join(dirFondo, anno, g, 'Race.json.gz');
    B.push(`| ${g} | ${existsSync(race) ? mostra(righeDi(race, true)) : 'null (Race assente)'} |`);
  }
  B.push('');
  blocchi.push(B.join('\n'));
}
R.push(`## Fondo 2018–2025 (${totGare} gare)`);
R.push('');
R.push(blocchi.join('\n'));

// ---- il resto di data/ ------------------------------------------------------
const elenco = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => !f.startsWith('README')).sort() : []);
R.push('## Riferimento storico (`data/storico/`)');
R.push('');
R.push('Modelli del VECCHIO motore: solo confronto, mai runtime.');
R.push('');
for (const f of elenco(path.join(dataDir, 'storico'))) R.push(`- \`${f}\``);
R.push('');
R.push('## Archivio dal futuro (`data/archivio/dal_futuro/`) — E14');
R.push('');
R.push('Costruito A GARA FINITA: MAI in percorsi live o a congelamento.');
R.push('');
for (const f of elenco(path.join(dataDir, 'archivio', 'dal_futuro'))) R.push(`- \`${f}\``);
R.push('');
R.push('## Prior esterni (`data/priors/`)');
R.push('');
for (const f of elenco(path.join(dataDir, 'priors'))) R.push(`- \`${f}\` (targhetta nel file)`);
R.push('');
R.push('## Derivati rigenerabili (`data/viste/`, `data/modelli/`)');
R.push('');
R.push('NON sono grezzo importato: si rigenerano dal grezzo con gli script citati');
R.push('nella loro targhetta. Restano pinnati nel manifest come tutto il resto di');
R.push('`data/`, quindi una modifica non dichiarata si vede.');
R.push('');
for (const f of elenco(path.join(dataDir, 'viste'))) R.push(`- \`viste/${f}\` — vista dei giri con passo utilizzabile (\`provenienza/esporta_vista_verde.mjs\`)`);
for (const f of elenco(path.join(dataDir, 'modelli'))) R.push(`- \`modelli/${f}\` — coefficienti con targhetta (\`fisica/stima_v2.py\`, δ deciso da \`banco/replay_delta.mjs\`)`);
R.push('');

// ---- rename registrati ------------------------------------------------------
R.push('## Rename registrati alla frontiera d\'import (E24)');
R.push('');
R.push('- **"Gran Bretagna" → "GranBretagna"**: il nome canonico 2026 perde lo spazio che spezzava i glob.');
R.push('- Ogni spazio in nomi di file/cartelle → `_` (es. `Practice 1.json` → `Practice_1.json`, `British Grand Prix` → `British_Grand_Prix`).');
R.push('- `Barcelona Grand Prix` / `Barcelona.json` → `Spagna` (nome canonico italiano del vecchio registro).');
R.push('- `data/fondo/_gare.json`, `gare_registro.json`, `mappa_gare.json` del vecchio repo NON importati: questo documento è la mappa unica.');
R.push('');
const testo = R.join('\n');

const argv = process.argv.slice(2);
if (argv.includes('--check')) {
  const iFile = argv.indexOf('--file');
  const target = iFile >= 0 ? path.resolve(argv[iFile + 1]) : path.join(dataDir, 'INVENTARIO.md');
  if (!existsSync(target)) muori(`--check: ${target} non esiste`);
  const committato = readFileSync(target, 'utf8');
  if (committato !== testo) {
    const a = committato.split('\n'); const b = testo.split('\n');
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
      if (a[i] !== b[i]) { muori(`divergenza alla riga ${i + 1}:\n  committato: ${a[i] ?? '<assente>'}\n  reale:      ${b[i] ?? '<assente>'}`); }
    }
    muori('divergenza');
  }
  console.log('inventario allineato ai file reali');
} else {
  writeFileSync(path.join(dataDir, 'INVENTARIO.md'), testo);
  console.log('inventario scritto: data/INVENTARIO.md');
}
