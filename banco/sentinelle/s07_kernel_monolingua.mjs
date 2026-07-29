// S07 — Il kernel esiste in UNA lingua (Regola 8, contro E19 e il doppio
// kernel JS+Python che è costato audit di allineamento continui).
// Il kernel è engine/kernel.mjs. La statistica in Python vive in fisica/ e
// produce JSON con targhetta: non re-implementa MAI la simulazione.
//
// FALLIREBBE SE: comparisse un .py dentro engine/; se un file di codice fuori
// da engine/ definisse una funzione di simulazione (`function simula` in JS o
// `def simula` in Python); o se engine/ smettesse di contenere il kernel.
import { nuovoBanco, RADICE } from '../lib/attrezzi.mjs';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const b = nuovoBanco('s07_kernel_monolingua');

b.verifica(existsSync(join(RADICE, 'engine', 'kernel.mjs')), 'engine/kernel.mjs non esiste: il kernel è sparito');

const ESCLUSE = new Set(['.git', 'node_modules', 'data', '.claude']); // dati e attrezzi, non codice del repo
function* fileCodice(dir) {
  for (const nome of readdirSync(dir)) {
    const pieno = join(dir, nome);
    if (statSync(pieno).isDirectory()) {
      if (!ESCLUSE.has(nome)) yield* fileCodice(pieno);
    } else if (['.mjs', '.js', '.py'].includes(extname(nome))) {
      yield pieno;
    }
  }
}

for (const f of fileCodice(RADICE)) {
  const rel = relative(RADICE, f);
  if (rel.startsWith('engine/')) {
    b.verifica(extname(f) === '.mjs', `${rel}: dentro engine/ solo .mjs — il runtime è monolingua`);
    continue;
  }
  const testo = readFileSync(f, 'utf8');
  b.verifica(!/(?:^|\s)function\s+simula\s*\(/.test(testo) && !/(?:^|\s)def\s+simula\w*\s*\(/.test(testo),
    `${rel}: definisce una simulazione fuori dal kernel — seconda implementazione vietata`);
}

b.fine();
