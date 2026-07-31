#!/usr/bin/env node
// run_suite.mjs — l'arbitro della suite (regola 4, E19/E23).
// Esegue ogni sentinella in banco/sentinelle/ (o in $SUITE_DIR, per potersi
// testare da solo) come processo figlio e PROPAGA l'exit code: se una sola
// sentinella esce != 0, la suite esce 1. Una suite che stampa FALLITO ed esce
// 0 è un ornamento — la sentinella s03 verifica proprio questo runner.

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const qui = path.dirname(fileURLToPath(import.meta.url));
const suiteDir = process.env.SUITE_DIR ?? path.join(qui, 'sentinelle');

const sentinelle = readdirSync(suiteDir).filter((f) => f.endsWith('.mjs')).sort();
if (sentinelle.length === 0) {
  // Una suite vuota non è una suite verde: è l'assenza di un banco.
  console.error(`SUITE VUOTA: nessuna sentinella in ${suiteDir}`);
  process.exit(1);
}

let falliti = 0;
for (const f of sentinelle) {
  const r = spawnSync(process.execPath, [path.join(suiteDir, f)], { stdio: 'inherit' });
  const code = r.status ?? 1; // processo ucciso da segnale = fallimento
  console.log(`${code === 0 ? 'PASSA ' : 'FALLITA'}  ${f}`);
  if (code !== 0) falliti += 1;
}

console.log(`\nsuite: ${sentinelle.length - falliti}/${sentinelle.length} sentinelle verdi`);
process.exit(falliti === 0 ? 0 : 1);
