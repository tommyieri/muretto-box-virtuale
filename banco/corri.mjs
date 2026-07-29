// L'arbitro: corre tutte le sentinelle e esce 1 se anche UNA fallisce.
// Regola 4 al livello meta: ogni sentinella deve dichiarare nel proprio testo
// cosa la farebbe fallire (la stringa 'FALLIREBBE SE'); una sentinella senza
// potere di fallire dichiarato non corre nemmeno — è già un fallimento.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const qui = dirname(fileURLToPath(import.meta.url));
const cartella = join(qui, 'sentinelle');
const sentinelle = readdirSync(cartella).filter(f => f.endsWith('.mjs')).sort();

if (sentinelle.length === 0) {
  console.error('FALLITO  banco vuoto: nessuna sentinella trovata');
  process.exit(1);
}

let guaste = 0;
for (const nome of sentinelle) {
  const percorso = join(cartella, nome);
  if (!readFileSync(percorso, 'utf8').includes('FALLIREBBE SE')) {
    console.error(`FALLITO  ${nome} — non dichiara cosa la farebbe fallire (Regola 4)`);
    guaste += 1;
    continue;
  }
  const esito = spawnSync(process.execPath, [percorso], { encoding: 'utf8' });
  process.stdout.write(esito.stdout);
  process.stderr.write(esito.stderr);
  if (esito.status !== 0) guaste += 1;
}

console.log(guaste === 0
  ? `\nBANCO VERDE — ${sentinelle.length} sentinelle`
  : `\nBANCO ROSSO — ${guaste}/${sentinelle.length} sentinelle guaste`);
process.exit(guaste === 0 ? 0 : 1);
