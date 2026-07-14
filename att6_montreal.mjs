// att6_montreal.mjs — ATT6 dell'attivazione Montreal (24,37 -> 18,96).
// Identico nel metodo a att6_silverstone.mjs (gara demo "Canada", 2026).
// Selezione DICHIARATA A PRIORI: primi 3 stop verdi validi (cambio gomme, no drive-through,
// no primo/ultimo giro) del Canada 2026 da FastF1, ordinati per (giro, pilota), un solo stop
// per pilota, CON pit >= giro 5 (freeze = pit-2 deve esistere con pace-base: i pit del giro 2
// sono danni del via, non strategia — adattamento dichiarato rispetto a Silverstone, dove il
// problema non si poneva). REALE = posizione a fine out-lap (rango per cum_time).
// Exit 0 = ATT6 passa (>=2/3 migliorati, criterio del mandato), 1 = rollback.
import { evaluatePit } from './demo/pitscenario.mjs';
import fs from 'fs';

const GARA = 'Canada';
const OLD_LOSS = 24.37, NEW_LOSS = 18.96;
const CASI = [
  { driver: 'BOT', pitLap: 9 },
  { driver: 'STR', pitLap: 14 },
  { driver: 'NOR', pitLap: 15 },
];

const r = JSON.parse(fs.readFileSync(`demo/data/${GARA}.json`, 'utf8'));
r.byLap = {}; for (const lp of r.laps) r.byLap[lp.lap] = lp.cars;
const present = (L) => Object.keys(r.byLap[L]).filter(d => typeof r.byLap[L][d].cum_time === 'number');

function reale(driver, pitLap) {
  const L = pitLap + 1;
  const cars = present(L).sort((a, b) => r.byLap[L][a].cum_time - r.byLap[L][b].cum_time);
  return { pos: cars.indexOf(driver) + 1, su: cars.length };
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
    prima: `P${prima.rientro_pos}/${prima.su_totale}`, adesso: `P${adesso.rientro_pos}/${adesso.su_totale}`,
    reale: `P${vero.pos}/${vero.su}`, eP, eA,
    esito: eA < eP ? 'MIGLIORATO' : (eA > eP ? 'PEGGIORATO' : 'INVARIATO') });
}

console.log('ATT6 — Canada (2026), pit-loss 24,37 -> 18,96');
console.log('caso                          | PRIMA (24,37) | ADESSO (18,96) | REALE   | esito');
for (const x of righe)
  console.log(`${x.caso.padEnd(29)} | ${x.prima.padEnd(13)} | ${x.adesso.padEnd(14)} | ${x.reale.padEnd(7)} | ${x.esito} (err ${x.eP}->${x.eA})`);
const pass = migliorati >= 2;
console.log(`\nmigliorati ${migliorati}/3, peggiorati ${peggiorati}/3 -> ATT6 ${pass ? 'PASSA' : 'FALLISCE: ROLLBACK'}`);
process.exit(pass ? 0 : 1);
