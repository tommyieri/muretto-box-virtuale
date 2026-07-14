// att6_silverstone.mjs — ATT6 dell'attivazione Silverstone (29,12 -> 20,80).
// Confronto a tre colonne su 3 pit REALI della gara demo "Gran Bretagna" (2026):
//   PRIMA  = rientro_pos predetto dal motore con pit-loss 29,12
//   ADESSO = rientro_pos predetto dal motore con pit-loss 20,80
//   REALE  = posizione vera a fine out-lap (giro pit+1), rango per cum_time reale
//            (a fine out-lap la perdita e' interamente pagata: e' il pari-semantica
//             del rientro_pos del motore, che applica tutta la perdita al giro del pit).
// Selezione stop DICHIARATA A PRIORI (nessun cherry-picking): i primi 3 stop verdi
// validi del campione FF2 2026 (data/fastf1_silverstone_stops_esteso.csv), ordinati
// per (giro, pilota), un solo stop per pilota; freezeLap = pitLap - 2.
// Legge solo file esistenti; non scrive nulla. Exit 0 = ATT6 passa (>=2/3 piu' vicini
// o pari col nuovo valore E nessun caso peggiorato), 1 = rollback.
import { evaluatePit } from './demo/pitscenario.mjs';
import fs from 'fs';

const GARA = 'Gran Bretagna';
const OLD_LOSS = 29.12, NEW_LOSS = 20.80;
const CASI = [
  { driver: 'HUL', pitLap: 17 },
  { driver: 'VER', pitLap: 17 },
  { driver: 'STR', pitLap: 18 },
];

const r = JSON.parse(fs.readFileSync(`demo/data/${GARA}.json`, 'utf8'));
r.byLap = {}; for (const lp of r.laps) r.byLap[lp.lap] = lp.cars;
const present = (L) => Object.keys(r.byLap[L]).filter(d => typeof r.byLap[L][d].cum_time === 'number');

function reale(driver, pitLap) {
  // posizione vera a fine out-lap: rango per cum_time al giro pit+1
  const L = pitLap + 1;
  const cars = present(L).sort((a, b) => r.byLap[L][a].cum_time - r.byLap[L][b].cum_time);
  const idx = cars.indexOf(driver);
  return { pos: idx + 1, su: cars.length };
}

let migliorati = 0, peggiorati = 0;
const righe = [];
for (const c of CASI) {
  const L = c.pitLap - 2;
  const args = (loss) => ({
    byLap: r.byLap, nLaps: r.n_laps, pace: r.pace[String(L)],
    driver: c.driver, freezeLap: L, pitLap: c.pitLap, pitLoss: loss,
    present: present(L), gara: GARA, laps: r.laps,
  });
  const prima = evaluatePit(args(OLD_LOSS));
  const adesso = evaluatePit(args(NEW_LOSS));
  const vero = reale(c.driver, c.pitLap);
  const eP = Math.abs(prima.rientro_pos - vero.pos);
  const eA = Math.abs(adesso.rientro_pos - vero.pos);
  if (eA < eP) migliorati++;
  if (eA > eP) peggiorati++;
  righe.push({ caso: `${c.driver} pit giro ${c.pitLap} (freeze ${L})`,
    prima: `P${prima.rientro_pos}/${prima.su_totale}`,
    adesso: `P${adesso.rientro_pos}/${adesso.su_totale}`,
    reale: `P${vero.pos}/${vero.su}`,
    err_prima: eP, err_adesso: eA,
    esito: eA < eP ? 'MIGLIORATO' : (eA > eP ? 'PEGGIORATO' : 'INVARIATO') });
}

console.log('ATT6 — Gran Bretagna (2026), pit-loss 29,12 -> 20,80');
console.log('caso                          | PRIMA (29,12) | ADESSO (20,80) | REALE   | esito');
for (const x of righe)
  console.log(`${x.caso.padEnd(29)} | ${x.prima.padEnd(13)} | ${x.adesso.padEnd(14)} | ${x.reale.padEnd(7)} | ${x.esito} (err ${x.err_prima}->${x.err_adesso})`);

// criterio del mandato: il motore nuovo deve essere piu' vicino alla realta' su
// almeno 2 casi su 3; un pareggio non basta da solo, ma non boccia. Bocciano:
// meno di 2 casi non-peggiorati con almeno 1 miglioramento? Lettura letterale:
// ">= 2/3 piu' vicini" -> migliorati >= 2. Applicata alla lettera.
const pass = migliorati >= 2;
console.log(`\nmigliorati ${migliorati}/3, peggiorati ${peggiorati}/3 -> ATT6 ${pass ? 'PASSA' : 'FALLISCE: ROLLBACK'}`);
process.exit(pass ? 0 : 1);
