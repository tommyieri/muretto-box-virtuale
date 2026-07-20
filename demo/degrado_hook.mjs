// degrado_hook.mjs — GANCIO BANDA-DEGRADO v1.5 (meccanismo puro, ADDITIVO, fuori dal kernel).
//
// Il kernel congelato (demo/engine.mjs::simulate) applica una pace PIATTA per pilota,
// identica ad ogni giro. Questo gancio NON lo modifica: lo CHIAMA un giro alla volta
// (steps=1) e, prima di ogni giro, somma alla pace la penalita'-degrado del compound a
// quel giro-di-stint. Poiche' simulate(steps=1) ripetuto N volte, con cum riportato via
// state, e' identico a simulate(steps=N), a BANDA NULLA (0,0,0) il gancio e' inerte e
// l'output e' bit-identico a oggi (verificato in test_degrado_hook.mjs).
//
// v1.5 = SOLO MECCANISMO. La banda e' un INPUT (per i test, sintetica e arbitraria). Da
// dove vengano i valori veri e' v2/v3. Nessun degrado stimato qui; i 4 campi strategici
// (undercut/overcut/delta_strategia/aria_libera) NON vengono toccati.
import { simulate } from './engine.mjs';

// --- FORMA DI ACCUMULO (isolata e sostituibile: domani lineare+log senza cambiare l'API) ---
// v1.5: LINEARE. penalita(giro-di-stint) = rate * max(0, tyre_age - L_RIF).
// L_RIF=1: l'out-lap (life=1, traversamento pit-lane) e' escluso -> penalita' 0 a life<=1,
// il degrado cresce dal primo giro lanciato in poi. Il warm-in (gia' trattato altrove:
// life=1 escluso; +0.2/0.4 SOFT/MEDIUM, ~-0.12/-0.20 HARD) NON viene raddoppiato: il
// degrado si somma DOPO, sulla pace-base, non ri-aggiunge un bump del primo giro.
export const L_RIF = 1;
export function penalitaDegrado(rate, tyreAge, lRif = L_RIF) {
  if (!rate || tyreAge == null) return 0;
  return rate * Math.max(0, tyreAge - lRif);
}

// Un intero run di routing con una data terna di rate per compound (UNO scenario).
// Chiama il kernel CONGELATO giro-per-giro; a banda nulla -> identico a simulate(steps).
//   rate      : { compound: number }  (la rate del compound per QUESTO scenario)
//   tyreAge0  : { drv: tyre_age al freeze }   compound : { drv: 'SOFT'|'MEDIUM'|'HARD'|null }
// tyre-age v1.5 = tyreAge0 + s (continuo dal freeze): il gancio degrada la pace piatta con
// l'eta' gomma; NON modella il reset gomme post-pit (e' l'undercut, v2 — resta null).
export function simulaScenario({ state, pace, tyreAge0, compound, rate,
                                 track = 1.0, steps = 5, freezeLap = 0, pit = null,
                                 ZONE = 1.5, STRENGTH = 1.0 }) {
  const drivers = Object.keys(state);
  let cum = {};
  for (const d of drivers) cum[d] = state[d].cum_time;
  for (let s = 0; s < steps; s++) {
    const curLap = freezeLap + s;
    const paceAdj = {};
    for (const d of drivers) {
      const p = pace[d];
      if (p === undefined || p === null) continue;          // stesso criterio del kernel
      const r = (rate && compound[d]) ? (rate[compound[d]] ?? 0) : 0;
      paceAdj[d] = p + penalitaDegrado(r, (tyreAge0[d] ?? 0) + s);
    }
    const st1 = {};
    for (const d of drivers) st1[d] = { cum_time: cum[d] };
    cum = simulate({ state: st1, pace: paceAdj, track, steps: 1, freezeLap: curLap, pit, ZONE, STRENGTH });
  }
  return cum;
}

// Propaga una BANDA come TRE run interi e coerenti (non un +-intervallo sul risultato).
//   banda : { compound: [rate_min, rate_central, rate_max] }
// ottimistico = rate_min (meno degrado), centrale = rate_central, pessimistico = rate_max.
// A banda (0,0,0) per tutti i compound i tre scenari COLLASSANO sul singolo run di oggi.
export function treScenari({ state, pace, tyreAge0, compound, banda, ...routing }) {
  const rateAt = i => Object.fromEntries(
    Object.entries(banda || {}).map(([c, terna]) => [c, terna[i]]));
  const run = i => simulaScenario({ state, pace, tyreAge0, compound, rate: rateAt(i), ...routing });
  return { ottimistico: run(0), centrale: run(1), pessimistico: run(2) };
}
