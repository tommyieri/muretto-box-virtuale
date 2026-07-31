#!/usr/bin/env node
// verifica_manifest.mjs — ogni file di data/ contro data/MANIFEST.sha256.
// Fallimento RUMOROSO (regola 7, E18): esce 1 se un file è corrotto, mancante,
// intruso (presente su disco ma non pinnato), se un percorso contiene spazi
// (E24) o se il manifest stesso ha righe malformate. Niente validità
// "size > 1000", niente silenzi.
//
// Uso: node provenienza/verifica_manifest.mjs [--root <dir>]

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { NOME_MANIFEST, elencaFileData, leggiManifest, sha256File } from './manifest_lib.mjs';

const argv = process.argv.slice(2);
const iRoot = argv.indexOf('--root');
const root = iRoot >= 0 ? path.resolve(argv[iRoot + 1]) : path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

if (!existsSync(path.join(root, 'data', NOME_MANIFEST))) {
  console.error(`MANIFEST ASSENTE: data/${NOME_MANIFEST} non esiste — i dati non sono pinnati`);
  process.exit(1);
}

const { attesi, malformate } = leggiManifest(root);
const { file, conSpazi } = elencaFileData(root);
const problemi = [];

for (const r of malformate) problemi.push(`MALFORMATA nel manifest: "${r}"`);
for (const rel of conSpazi) problemi.push(`SPAZIO nel percorso (E24): ${rel}`);

const suDisco = new Set(file);
for (const [rel, hashAtteso] of attesi) {
  if (!suDisco.has(rel)) { problemi.push(`MANCANTE: ${rel}`); continue; }
  const hash = sha256File(path.join(root, rel));
  if (hash !== hashAtteso) problemi.push(`CORROTTO: ${rel}\n  atteso ${hashAtteso}\n  reale  ${hash}`);
}
for (const rel of file) if (!attesi.has(rel)) problemi.push(`INTRUSO (non pinnato): ${rel}`);

if (problemi.length > 0) {
  console.error(`MANIFEST VIOLATO — ${problemi.length} problema/i:\n` + problemi.map((p) => `  ${p}`).join('\n'));
  process.exit(1);
}
console.log(`manifest verificato: ${attesi.size} file integri`);
