#!/usr/bin/env node
// importa_archivio.mjs — l'UNICA porta da cui i dati del vecchio repo entrano
// qui (Missione: "da zero" = codice da zero; i dati si EREDITANO, pinnati).
//
// Fonte: clone di sola lettura in _archivio/muretto-box-virtuale, pretesa al
// commit pinnato qui sotto (regola 7, E18): se HEAD non corrisponde, rifiuto.
// Trasformazioni ALLA FRONTIERA, tutte registrate in INVENTARIO.md (E24):
//   - ogni spazio nei nomi di file/cartelle diventa "_";
//   - le gare 2026 prendono il nome canonico italiano del vecchio registro,
//     con "Gran Bretagna" → "GranBretagna";
//   - _gare.json / gare_registro.json / mappa_gare.json NON si importano:
//     la mappa unica è data/INVENTARIO.md.
// Dopo l'import: genera_manifest.mjs (deliberato) e genera_inventario.mjs.
//
// Uso: node provenienza/importa_archivio.mjs

import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const SHA_FONTE = '90d9a19c334eae84b806bd2f401c8ed4770a7169'; // origin/main del vecchio repo, 2026-07-29

// Nome canonico italiano delle gare 2026 (dal gare_registro.json del vecchio
// repo, con il rename E24). Una gara NON in questa mappa fa fallire l'import:
// niente mappe parziali silenziose.
const GARE_2026 = {
  'Australian Grand Prix': 'Australia',
  'Austrian Grand Prix': 'Austria',
  'Barcelona Grand Prix': 'Spagna',
  'Belgian Grand Prix': 'Belgio',
  'British Grand Prix': 'GranBretagna',
  'Canadian Grand Prix': 'Canada',
  'Chinese Grand Prix': 'Cina',
  'Hungarian Grand Prix': 'Ungheria',
  'Japanese Grand Prix': 'Giappone',
  'Miami Grand Prix': 'Miami',
  'Monaco Grand Prix': 'Monaco',
};
const CACHE_2026 = Object.fromEntries(
  Object.entries(GARE_2026).map(([gp, it]) => [gp.replace(' Grand Prix', ''), it]),
);

const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const fonte = path.join(radice, '_archivio', 'muretto-box-virtuale');
const senzaSpazi = (s) => s.replaceAll(' ', '_');
const muori = (msg) => { console.error(`IMPORT RIFIUTATO: ${msg}`); process.exit(1); };

if (!existsSync(fonte)) muori(`fonte assente: ${fonte} (clona il vecchio repo in _archivio/)`);
const head = execFileSync('git', ['-C', fonte, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (head !== SHA_FONTE) muori(`la fonte è a ${head}, il pin è ${SHA_FONTE} (regola 7: niente fonti mutabili)`);

const copia = (rel, dest) => {
  const p = path.join(fonte, rel);
  if (!existsSync(p)) muori(`file atteso assente nella fonte: ${rel}`);
  mkdirSync(path.dirname(dest), { recursive: true });
  cpSync(p, dest);
};

// 1) fondo 2018–2025: sessioni .json.gz, spazi → "_"; _gare.json superato dall'inventario
let nFondo = 0;
const fondoSrc = path.join(fonte, 'data', 'fondo');
for (const anno of readdirSync(fondoSrc).sort()) {
  if (!/^\d{4}$/.test(anno)) continue;
  for (const gara of readdirSync(path.join(fondoSrc, anno)).sort()) {
    for (const sessione of readdirSync(path.join(fondoSrc, anno, gara)).sort()) {
      copia(path.posix.join('data/fondo', anno, gara, sessione),
        path.join(radice, 'data', 'fondo', anno, senzaSpazi(gara), senzaSpazi(sessione)));
      nFondo += 1;
    }
  }
}

// 2) grezzo gare 2026: ti_archive/2026 per sessione, ti_cache per giri gara
let nGare = 0;
const archSrc = path.join(fonte, 'data', 'ti_archive', '2026');
for (const gp of readdirSync(archSrc).sort()) {
  const it = GARE_2026[gp] ?? muori(`gara 2026 fuori mappa: "${gp}" (aggiorna la mappa, non ignorare)`);
  for (const sessione of readdirSync(path.join(archSrc, gp)).sort()) {
    copia(path.posix.join('data/ti_archive/2026', gp, sessione),
      path.join(radice, 'data', 'gare_2026', 'ti_archive', it, senzaSpazi(sessione)));
    nGare += 1;
  }
}
for (const f of readdirSync(path.join(fonte, 'data', 'ti_cache')).sort()) {
  const base = f.replace(/\.json$/, '');
  const it = CACHE_2026[base] ?? muori(`ti_cache fuori mappa: "${f}"`);
  copia(path.posix.join('data/ti_cache', f), path.join(radice, 'data', 'gare_2026', 'ti_cache', `${it}.json`));
  nGare += 1;
}

// 3) modelli del vecchio motore: SOLO riferimento storico
for (const f of ['modello_degrado_2026.json', 'modello_traffico_2026.json']) {
  copia(path.posix.join('data', f), path.join(radice, 'data', 'storico', f));
}

// 4) neutralizzazione dalla demo: VIENE DAL FUTURO, mai in percorsi live (E14)
copia('demo/neutralizzazione.json', path.join(radice, 'data', 'archivio', 'dal_futuro', 'neutralizzazione.json'));
copia('demo/data/neutralizzazione_fondo.json', path.join(radice, 'data', 'archivio', 'dal_futuro', 'neutralizzazione_fondo.json'));

console.log(`import completato: fondo ${nFondo} file, gare 2026 ${nGare} file, 2 modelli storici, 2 file dal futuro`);
console.log('ora: node provenienza/genera_manifest.mjs && node provenienza/genera_inventario.mjs');
