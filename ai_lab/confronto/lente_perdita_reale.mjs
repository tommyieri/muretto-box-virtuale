// lente_perdita_reale.mjs — LA PERDITA CHE LA GARA HA DAVVERO ADDEBITATO.
//
// Il motore nuovo applica `perdita_verde × fattore` (SC 0,50 · VSC 0,65), con il
// fattore preso da un PRIOR ESTERNO dichiarato a banda 0,40-0,60 / 0,60-0,70.
// Qui la perdita si MISURA sulle gare 2026, senza modelli:
//
//   perdita_realizzata = (cum[Lo] − cum[L]) del pilota che si ferma
//                        − mediana degli stessi due giri per chi NON si ferma
//
// e' il tempo che ha perso RISPETTO AL CAMPO fra il congelamento e il rientro,
// che e' esattamente cio' che sposta la posizione. Nessun kernel, nessun passo,
// nessun prior: solo `cum_time` del grezzo.
//
// Non scrive niente su disco. Non tocca demo/, simulatore/, data/.
//   node ai_lab/confronto/lente_perdita_reale.mjs

import { casi, garaNuova, contestoNuovo } from './banco.mjs';
import { perditaBox } from '../../simulatore/provenienza/pitloss.mjs';
import { regimeDiCella } from './lente_neutralizzazione.mjs';

const mediana = (v) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const q = (v, p) => { if (!v.length) return null; const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))]; };

const elenco = casi();
const prior = contestoNuovo().prior;
const righe = [];

for (const k of elenco) {
  const g = garaNuova(k.gara);
  const mie = g.perPilota.get(k.pilota);
  const L = k.freezeLap, Lo = k.rientroLap;
  const mioL = mie.get(L)?.cum_time, mioLo = mie.get(Lo)?.cum_time;
  if (typeof mioL !== 'number' || typeof mioLo !== 'number') continue;
  // il campo di riferimento: chi NON e' entrato ai box fra L+1 e Lo e ha i due cum
  const rif = [];
  for (const [drv, celle] of g.perPilota) {
    if (drv === k.pilota) continue;
    const a = celle.get(L)?.cum_time, b = celle.get(Lo)?.cum_time;
    if (typeof a !== 'number' || typeof b !== 'number') continue;
    if (celle.get(k.pitLap)?.in_lap === true || celle.get(Lo)?.in_lap === true) continue;
    if (celle.get(L)?.in_lap === true || celle.get(L)?.out_lap === true) continue;
    if (celle.get(k.pitLap)?.out_lap === true || celle.get(Lo)?.out_lap === true) continue;
    rif.push(b - a);
  }
  if (rif.length < 5) continue;
  const realizzata = (mioLo - mioL) - mediana(rif);
  const regimeCong = regimeDiCella(mie.get(L));
  const regimePit = regimeDiCella(mie.get(k.pitLap));
  const verde = perditaBox(prior, k.garaSim, null).perdita_verde;
  righe.push({ k, realizzata, regimeCong, regimePit, verde, nRif: rif.length,
               applicata: perditaBox(prior, k.garaSim, regimeCong).perdita });
}

const st = (v, et) => {
  const r = v.map((x) => x.realizzata);
  const f = v.map((x) => x.realizzata / x.verde);
  console.log(`  ${et.padEnd(42)} n=${String(v.length).padStart(3)} · perdita realizzata mediana ${mediana(r)?.toFixed(2)} s (p25 ${q(r, 0.25)?.toFixed(2)} · p75 ${q(r, 0.75)?.toFixed(2)}) · FATTORE realizzato mediano ${mediana(f)?.toFixed(3)} (p25 ${q(f, 0.25)?.toFixed(3)} · p75 ${q(f, 0.75)?.toFixed(3)})`);
};

console.log(`PERDITA REALIZZATA, misurata su ${righe.length} soste del perimetro (nessun modello: solo cum_time)`);
console.log('\n1 · PER REGIME AL GIRO DELLA SOSTA (la verita\' di cosa e\' successo)');
st(righe.filter((x) => x.regimePit === null), 'sosta in VERDE');
st(righe.filter((x) => x.regimePit === 'SC'), 'sosta sotto SC');
st(righe.filter((x) => x.regimePit === 'VSC'), 'sosta sotto VSC');

console.log('\n2 · PER REGIME AL CONGELAMENTO (cio\' che il motore usa per scegliere il fattore)');
st(righe.filter((x) => x.regimeCong === null), 'congelamento in VERDE');
st(righe.filter((x) => x.regimeCong === 'SC'), 'congelamento sotto SC');
st(righe.filter((x) => x.regimeCong === 'VSC'), 'congelamento sotto VSC');

console.log('\n3 · IL FATTORE: dichiarato dal prior contro realizzato dalla gara');
const f = prior.fattori_neutralizzazione;
for (const [reg, dich] of [['SC', f.SC], ['VSC', f.VSC]]) {
  const v = righe.filter((x) => x.regimePit === reg).map((x) => x.realizzata / x.verde);
  if (!v.length) continue;
  console.log(`  ${reg}: prior ${dich} (banda ${reg === 'SC' ? '0,40-0,60' : '0,60-0,70'}) · realizzato mediano ${mediana(v).toFixed(3)} · IC interquartile ${q(v, 0.25).toFixed(3)}-${q(v, 0.75).toFixed(3)} · n=${v.length}`);
}

console.log('\n4 · QUANTO SBAGLIA IL MOTORE, IN SECONDI, SUL SOLO PIT-LOSS');
for (const [et, filtro] of [['congelamento VERDE, sosta VERDE', (x) => x.regimeCong === null && x.regimePit === null],
                            ['congelamento VERDE, sosta NEUTRA', (x) => x.regimeCong === null && x.regimePit !== null],
                            ['congelamento NEUTRO, sosta NEUTRA', (x) => x.regimeCong !== null && x.regimePit !== null]]) {
  const v = righe.filter(filtro);
  if (!v.length) continue;
  const d = v.map((x) => x.applicata - x.realizzata);
  console.log(`  ${et.padEnd(34)} n=${String(v.length).padStart(3)} · applicata − realizzata: mediana ${mediana(d).toFixed(2)} s (p25 ${q(d, 0.25).toFixed(2)} · p75 ${q(d, 0.75).toFixed(2)})`);
}

console.log('\n5 · PER GARA (blocchi), soste sotto SC/VSC al giro della sosta — fattore realizzato mediano');
const pg = {};
for (const x of righe.filter((y) => y.regimePit !== null)) (pg[x.k.gara] ??= []).push(x.realizzata / x.verde);
for (const [gara, v] of Object.entries(pg).sort()) console.log(`  ${gara.padEnd(15)} n=${String(v.length).padStart(3)} · ${mediana(v).toFixed(3)}`);
