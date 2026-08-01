#!/usr/bin/env node
// ripinna.mjs — ri-pinna SOLO i file che si e' appena legittimamente riscritti,
// e verifica che tutto il resto di data/ sia rimasto quello di prima.
//
//     node provenienza/ripinna.mjs data/modelli/modello_v2.json data/modelli/banda_rientro.json
//
// PERCHE' ESISTE, invece di chiamare genera_manifest.mjs. Quello e' dichiarato
// "atto DELIBERATO: si esegue a mano quando si importa o si aggiorna un dato,
// mai in CI" — e ha ragione: rigenera OGNI riga, quindi benedice in silenzio
// qualunque cosa sia cambiata sotto data/, archivio grezzo compreso. Metterlo nel
// ciclo notturno non sarebbe automazione: sarebbe spegnere la regola 7 lasciando
// il file al suo posto, che e' il modo peggiore di spegnere una tutela.
//
// Dal 01/08/2026 il ciclo post-gara ri-stima rho, delta70, il rodaggio e la banda
// di rientro (direttiva del PO: ogni gara nuova aggiorna tutto). Quei due file
// CAMBIANO per costruzione, e il loro hash va aggiornato. Tutti gli altri no — e
// se uno cambia, e' una notizia, non una formalita'.
//
// COSA FA:
//   1. per ogni percorso passato: ricalcola l'hash e riscrive la sua riga;
//   2. per OGNI ALTRA riga del manifest: verifica che il file esista e che l'hash
//      combaci ancora. Se non combacia, ESCE 1 senza scrivere niente.
//
// Quindi un ciclo notturno che tocca per sbaglio (o per compromissione) un file
// del grezzo non riesce a nascondersi dietro un ri-pinning di routine.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { NOME_MANIFEST, sha256File } from './manifest_lib.mjs';

const argv = process.argv.slice(2);
const iRoot = argv.indexOf('--root');
const root = iRoot >= 0 ? path.resolve(argv[iRoot + 1]) : path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const daRipinnare = new Set(argv.filter((a, i) => !a.startsWith('--') && (iRoot < 0 || i !== iRoot + 1)));

if (daRipinnare.size === 0) {
  console.error('ripinna: nessun percorso da ri-pinnare. Uso: node provenienza/ripinna.mjs data/modelli/xxx.json ...');
  process.exit(1);
}

const percorsoManifest = path.join(root, 'data', NOME_MANIFEST);
const righe = readFileSync(percorsoManifest, 'utf8').split('\n');

const intrusi = [];
const aggiornati = [];
const mancanti = [];
const uscita = righe.map((riga) => {
  const m = riga.match(/^([0-9a-f]{64})  (.+)$/);
  if (!m) return riga;                       // intestazione e righe vuote
  const [, hashVecchio, rel] = m;
  const assoluto = path.join(root, rel);
  if (!existsSync(assoluto)) { mancanti.push(rel); return riga; }
  const hashOra = sha256File(assoluto);
  if (daRipinnare.has(rel)) {
    if (hashOra !== hashVecchio) aggiornati.push(rel);
    return `${hashOra}  ${rel}`;
  }
  if (hashOra !== hashVecchio) intrusi.push(rel);
  return riga;
});

const nonTrovati = [...daRipinnare].filter((r) => !righe.some((l) => l.endsWith(`  ${r}`)));
if (nonTrovati.length) {
  console.error(`ripinna: questi percorsi non sono nel manifest, quindi non erano pinnati:\n  ${nonTrovati.join('\n  ')}`);
  process.exit(1);
}
if (mancanti.length) {
  console.error(`ripinna: file pinnati MANCANTI dal disco:\n  ${mancanti.join('\n  ')}`);
  process.exit(1);
}
if (intrusi.length) {
  console.error('ripinna: NON SCRIVO. Questi file sono cambiati e NON erano fra quelli da ri-pinnare:\n  '
    + `${intrusi.join('\n  ')}\n`
    + 'Un dato del fondo che cambia da solo e\' una notizia, non una formalita\': va guardato (regola 7, E18).');
  process.exit(1);
}

writeFileSync(percorsoManifest, uscita.join('\n'));
console.log(`ripinna: ${aggiornati.length} hash aggiornati`
  + (aggiornati.length ? ` (${aggiornati.join(', ')})` : ' — nessuno dei file indicati e\' cambiato')
  + `; verificati invariati gli altri ${righe.filter((l) => /^[0-9a-f]{64}  /.test(l)).length - daRipinnare.size}.`);
