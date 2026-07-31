#!/usr/bin/env node
// genera_manifest.mjs — rigenera data/MANIFEST.sha256 (regola 7, E18).
// Atto DELIBERATO: si esegue a mano quando si importa o si aggiorna un dato,
// mai in CI (la CI verifica soltanto). Esce 1 se un percorso contiene spazi:
// il rename avviene alla frontiera, prima di pinnare.
//
// Uso: node provenienza/genera_manifest.mjs [--root <dir>]
//   --root serve alle sentinelle per testare il ciclo su una fixture.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { NOME_MANIFEST, elencaFileData, sha256File } from './manifest_lib.mjs';

const argv = process.argv.slice(2);
const iRoot = argv.indexOf('--root');
const root = iRoot >= 0 ? path.resolve(argv[iRoot + 1]) : path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const { file, conSpazi } = elencaFileData(root);
if (conSpazi.length > 0) {
  console.error(`RIFIUTO di pinnare percorsi con spazi (E24):\n  ${conSpazi.join('\n  ')}`);
  process.exit(1);
}

const righe = file.map((rel) => `${sha256File(path.join(root, rel))}  ${rel}`);
const testa = [
  `# ${NOME_MANIFEST} — la verità sull'integrità di data/ (regola 7, E18)`,
  '# fonte import: tommyieri/muretto-box-virtuale @ 90d9a19c334eae84b806bd2f401c8ed4770a7169 (origin/main, 2026-07-29)',
  '# verifica: node provenienza/verifica_manifest.mjs   (esce 1 su corruzione/mancanza/intruso)',
  '# rigenerazione (solo su import deliberato): node provenienza/genera_manifest.mjs',
];
writeFileSync(path.join(root, 'data', NOME_MANIFEST), testa.join('\n') + '\n' + righe.join('\n') + '\n');
console.log(`manifest scritto: ${righe.length} file pinnati`);
