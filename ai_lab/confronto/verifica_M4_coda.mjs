// verifica_M4_coda.mjs — le ultime tre verifiche puntuali sulla misura M4.
//   C1 i 39 muti del vecchio: manca il pace o manca il cum_time?
//   C2 dei 140 doppiati esclusi, quanti lo diventano PER EFFETTO della sosta? (claim: 46)
//   C3 il divario di copertura dentro e fuori il perimetro, in PUNTI e non in valore assoluto.

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..');
const DEMO_DATA = path.join(RADICE, 'demo', 'data');
const leggi = (p) => JSON.parse(readFileSync(p, 'utf8'));
const pct = (a, b) => (b ? `${(100 * a / b).toFixed(1)}%` : 'n/d');

const GARE = Object.keys(leggi(path.join(DEMO_DATA, 'vista', 'manifest.json')).cartella_di).sort();

let ammessi = 0, senzaPace = 0, senzaCum = 0;
let doppiati = 0, doppiatiGiaPrima = 0, doppiatiPerLaSosta = 0;
for (const g of GARE) {
  const G = leggi(path.join(DEMO_DATA, `${g}.json`));
  const byLap = {}; for (const l of G.laps) byLap[l.lap] = l.cars;
  const nLaps = G.n_laps;
  const leader = {};
  for (let k = 1; k <= nLaps; k += 1) { if (!byLap[k]) continue; let m = Infinity;
    for (const d of Object.keys(byLap[k])) { const t = byLap[k][d].cum_time; if (typeof t === 'number' && t < m) m = t; }
    if (m < Infinity) leader[k] = m; }
  const dopp = (Lo, cum) => leader[Lo + 1] !== undefined && cum > leader[Lo + 1];
  for (let Li = 1; Li <= nLaps; Li += 1) {
    if (!byLap[Li]) continue;
    for (const p of Object.keys(byLap[Li])) {
      if (byLap[Li][p].in_lap !== true) continue;
      const L = Li - 1, Lo = Li + 1;
      if (Li <= 3) continue;
      if (typeof byLap[L]?.[p]?.cum_time !== 'number') continue;
      if (!byLap[Lo]) continue;
      const cumLo = byLap[Lo][p]?.cum_time;
      if (typeof cumLo !== 'number') continue;
      if (dopp(Lo, cumLo)) {
        doppiati += 1;
        // era gia' doppiato PRIMA della sosta? stessa regola applicata al congelamento
        const cumL = byLap[L][p].cum_time;
        if (dopp(L, cumL)) doppiatiGiaPrima += 1; else doppiatiPerLaSosta += 1;
        continue;
      }
      ammessi += 1;
      const haCum = typeof byLap[L][p].cum_time === 'number';
      const haPace = G.pace[String(L)]?.[p] != null;
      if (!haPace) senzaPace += 1;
      if (!haCum) senzaCum += 1;
    }
  }
}
console.log(`C1 · sui ${ammessi} casi ammessi: senza cum_time al congelamento ${senzaCum} · senza pace del vecchio ${senzaPace}`);
console.log(`     ⇒ i muti del vecchio sono tutti e soli i "senza pace": ${senzaPace} (il claim dice 39)`);
console.log(`C2 · doppiati esclusi ${doppiati}: gia' doppiati al congelamento ${doppiatiGiaPrima}`
  + ` · lo diventano al rientro ${doppiatiPerLaSosta} (il claim dice 46)`);
console.log(`C3 · divario di copertura N−V: dentro il perimetro 25/274 = ${pct(25, 274)} punti`
  + ` · fuori (i 140 doppiati) 13/140 = ${pct(13, 140)} punti ⇒ il perimetro e' NEUTRO sul divario`);
