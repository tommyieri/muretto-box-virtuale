// gen_motore_appaiato.mjs — confronti APPAIATI, sweep dei parametri, decomposizione del bias.
//
//   node gen_motore_appaiato.mjs
//
// Il primo banco (gen_backtest_motore.mjs) ha dato IC95 marginali che si sovrappongono tutti.
// Confrontare due intervalli sovrapposti e' l'errore classico: la differenza va misurata
// APPAIATA sugli stessi blocchi (le gare), com'e' regola nel laboratorio.
//
// Tre cose:
//   1. APPAIATO   ogni variante contro il kernel com'e', differenza per gara, IC95 a blocchi.
//   2. SWEEP      ZONE e STRENGTH sono PARAMETRI di simulate: si esplorano senza toccare il
//                 kernel. I valori congelati (1,5 e 1,0) sono vicini all'ottimo del 2026?
//   3. BIAS       da che cosa e' fatto l'errore comune? Si regredisce il bias osservato su
//                 (carburante bruciato nella finestra) e (giri di gomma in piu'), cosi' i
//                 pezzi devono TORNARE con la fisica invece di essere attribuiti a occhio.
import { simulate } from './demo/engine.mjs';
import fs from 'fs';

const GARE = ['Australia', 'Cina', 'Giappone', 'Miami', 'Canada', 'Monaco', 'Spagna',
              'Austria', 'Gran Bretagna', 'Belgio'];
const TRAFFICO_FONDO = { a: 0.74781, lam: 0.5 };
const RHO = { SOFT: 0.0541, MEDIUM: 0.0441, HARD: 0.0398 };
const PASSO_FREEZE = 3;

const mediana = v => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function caricaGara(nome) {
  const r = JSON.parse(fs.readFileSync(`./demo/data/${nome}.json`, 'utf8'));
  r.byLap = {};
  for (const lp of r.laps) r.byLap[lp.lap] = lp.cars;
  return r;
}

function finestraPulita(r, d, L, S) {
  for (let k = L + 1; k <= L + S; k++) {
    const c = r.byLap[k]?.[d];
    if (!c || c.neutralized || c.in_lap || c.out_lap || typeof c.cum_time !== 'number') return false;
  }
  const c0 = r.byLap[L]?.[d];
  return !!(c0 && typeof c0.cum_time === 'number' && !c0.neutralized);
}

function casi(S) {
  const out = [];
  for (const g of GARE) {
    const r = caricaGara(g);
    for (let L = 6; L + S <= r.n_laps - 1; L += PASSO_FREEZE) {
      const pace = r.pace[String(L)];
      if (!pace) continue;
      const presenti = Object.keys(r.byLap[L] || {}).filter(
        d => pace[d] != null && finestraPulita(r, d, L, S));
      if (presenti.length < 6) continue;
      out.push({ gara: g, r, L, S, presenti, pace });
    }
  }
  return out;
}

function reinflaziona(c, pace, totale) {
  const N = c.r.n_laps, fpl = 70.0 / N, coeff = totale / 70.0;
  let somma = 0;
  for (let k = c.L; k < c.L + c.S; k++) somma += Math.max(0, 70.0 - fpl * (k - 1)) * coeff;
  const medio = somma / c.S;
  const out = {};
  for (const d of Object.keys(pace)) out[d] = pace[d] + medio;
  return out;
}

function errori(c, opzioni) {
  const state = {}, pace = {}, comp = {};
  for (const d of c.presenti) {
    const x = c.r.byLap[c.L][d];
    state[d] = { cum_time: x.cum_time };
    pace[d] = c.pace[d];
    comp[d] = x.compound;
  }
  const extra = { ...opzioni };
  if (extra.degrado === 'FONDO') {
    const deg = {};
    for (const d of c.presenti) deg[d] = { rate: RHO[comp[d]] ?? 0, age0: 0 };
    extra.degrado = deg;
  }
  let paceUso = pace;
  if (extra.fuel != null) { paceUso = reinflaziona(c, pace, extra.fuel); delete extra.fuel; }
  const fine = simulate({ state, pace: paceUso, freezeLap: c.L, steps: c.S, ...extra });
  const out = [];
  for (const d of c.presenti) {
    const p = fine[d];
    if (typeof p !== 'number') continue;
    const t0 = c.r.byLap[c.L][d].cum_time;
    out.push((p - t0) - (c.r.byLap[c.L + c.S][d].cum_time - t0));
  }
  return out;
}

function relPerGara(C, opz) {
  const acc = {};
  for (const c of C) {
    const e = errori(c, opz);
    if (e.length < 6) continue;
    const b = mediana(e);
    (acc[c.gara] ||= []).push(mediana(e.map(x => Math.abs(x - b))));
  }
  const out = {};
  for (const g of Object.keys(acc)) out[g] = mediana(acc[g]);
  return out;
}

function boot(vals, repliche = 4000, seed = 20260721) {
  if (vals.length < 2) return null;
  let s = seed;
  const rnd = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const med = [];
  for (let i = 0; i < repliche; i++) {
    const camp = [];
    for (let j = 0; j < vals.length; j++) camp.push(vals[Math.floor(rnd() * vals.length)]);
    med.push(mediana(camp));
  }
  med.sort((a, b) => a - b);
  return [med[Math.floor(0.025 * repliche)], med[Math.floor(0.975 * repliche)]];
}

function main() {
  const risultati = {};
  for (const S of [5, 10]) {
    const C = casi(S);
    console.log('='.repeat(98));
    console.log(`APPAIATO CONTRO IL KERNEL — orizzonte ${S} giri, ${C.length} casi`);
    console.log('='.repeat(98));
    const base = relPerGara(C, {});
    const gare = Object.keys(base);
    const VAR = {
      'traffico SPENTO': { ZONE: 0 },
      'traffico del FONDO': { traffico: TRAFFICO_FONDO },
      'degrado del FONDO': { degrado: 'FONDO' },
      'carburante ri-aggiunto (3,0)': { fuel: 3.0 },
      'tutto il fondo insieme': { fuel: 2.1939, traffico: TRAFFICO_FONDO, degrado: 'FONDO' },
    };
    console.log(`  ${'variante'.padEnd(32)} ${'delta mediano'.padStart(14)} ${'IC95 appaiato'.padStart(22)}  esito`);
    for (const [nome, opz] of Object.entries(VAR)) {
      const alt = relPerGara(C, opz);
      const d = gare.filter(g => alt[g] != null).map(g => alt[g] - base[g]);   // >0 = PEGGIO del kernel
      const m = mediana(d), ci = boot(d);
      const esito = ci[0] > 0 ? 'PEGGIORA (IC esclude 0)'
                  : ci[1] < 0 ? 'MIGLIORA (IC esclude 0)' : 'indistinguibile dal kernel';
      console.log(`  ${nome.padEnd(32)} ${m.toFixed(4).padStart(14)} ` +
                  `${('[' + ci[0].toFixed(3) + ', ' + ci[1].toFixed(3) + ']').padStart(22)}  ${esito}`);
      risultati[`S${S}|appaiato|${nome}`] = { delta: m, ci95: ci, esito };
    }

    // --- SWEEP dei due parametri congelati
    console.log(`\n  SWEEP dei parametri congelati (ZONE=1.5, STRENGTH=1.0 sono i valori in kernel)`);
    console.log(`  ${'ZONE'.padStart(6)} ${'STRENGTH'.padStart(9)} ${'|err relativo|'.padStart(14)} ${'delta vs kernel'.padStart(16)}`);
    const griglia = [];
    for (const Z of [0, 0.5, 1.0, 1.5, 2.0, 3.0]) {
      for (const ST of [0.25, 0.5, 1.0]) {
        if (Z === 0 && ST !== 1.0) continue;
        const alt = relPerGara(C, { ZONE: Z, STRENGTH: ST });
        const m = mediana(Object.values(alt));
        const d = mediana(gare.filter(g => alt[g] != null).map(g => alt[g] - base[g]));
        griglia.push({ ZONE: Z, STRENGTH: ST, rel: m, delta: d });
        const marca = (Z === 1.5 && ST === 1.0) ? '   <- il kernel' : '';
        console.log(`  ${String(Z).padStart(6)} ${String(ST).padStart(9)} ${m.toFixed(4).padStart(14)} ${d.toFixed(4).padStart(16)}${marca}`);
      }
    }
    griglia.sort((a, b) => a.rel - b.rel);
    console.log(`  => migliore della griglia: ZONE=${griglia[0].ZONE} STRENGTH=${griglia[0].STRENGTH} ` +
                `(${griglia[0].rel.toFixed(4)}, kernel ${mediana(Object.values(base)).toFixed(4)})`);
    risultati[`S${S}|sweep`] = griglia;
  }

  // --- DECOMPOSIZIONE DEL BIAS: i pezzi devono TORNARE con la fisica
  console.log('\n' + '='.repeat(98));
  console.log('DA CHE COSA E FATTO IL BIAS COMUNE — i conti devono tornare');
  console.log('='.repeat(98));
  const S = 5, C = casi(S);
  let sommaBias = 0, sommaFuel = 0, sommaEta = 0, n = 0;
  for (const c of C) {
    const e = errori(c, {});
    if (e.length < 6) continue;
    const bias = mediana(e);
    // carburante bruciato DENTRO la finestra, col coefficiente del kernel
    const N = c.r.n_laps, fpl = 70.0 / N;
    let f = 0;
    for (let k = c.L; k < c.L + c.S; k++) f += Math.max(0, 70.0 - fpl * (k - 1)) * (3.0 / 70.0);
    // quanti giri di gomma in piu' hanno le gomme nella finestra rispetto a quelle
    // che hanno prodotto `pace` (mediana dello stint fino a L)
    const eta = [];
    for (const d of c.presenti) {
      const x = c.r.byLap[c.L][d];
      const st = x.stint;
      const passati = [];
      for (let k = 1; k <= c.L; k++) {
        const y = c.r.byLap[k]?.[d];
        if (y && y.stint === st && !y.neutralized && !y.in_lap && !y.out_lap) passati.push(y.tyre_age);
      }
      if (passati.length) eta.push((x.tyre_age + c.S / 2) - mediana(passati));
    }
    sommaBias += bias; sommaFuel += f; sommaEta += (mediana(eta) ?? 0); n++;
  }
  const bm = sommaBias / n, fm = sommaFuel / n, em = sommaEta / n;
  const rhoMed = RHO.MEDIUM;
  console.log(`  casi: ${n}, orizzonte ${S} giri`);
  console.log(`  bias comune OSSERVATO                              ${bm.toFixed(3)} s  (${(bm / S).toFixed(3)} s/giro)`);
  console.log(`  carburante non ri-aggiunto (coeff kernel 3,0)      ${(-fm).toFixed(3)} s  (${(-fm / S).toFixed(3)} s/giro)`);
  console.log(`  gomma piu vecchia della finestra di misura del passo:`);
  console.log(`     ${em.toFixed(2)} giri di eta in piu x rho_MEDIUM ${rhoMed}  =  ${(-em * rhoMed * S).toFixed(3)} s  (${(-em * rhoMed).toFixed(3)} s/giro)`);
  const spiegato = -fm - em * rhoMed * S;
  console.log(`  --------------------------------------------------`);
  console.log(`  somma dei due pezzi                                ${spiegato.toFixed(3)} s`);
  console.log(`  residuo non spiegato                               ${(bm - spiegato).toFixed(3)} s  ` +
              `(${(100 * (1 - Math.abs(bm - spiegato) / Math.abs(bm))).toFixed(0)} % del bias e spiegato)`);
  risultati.decomposizione = { bias_osservato: bm, carburante: -fm, eta_extra_giri: em,
                               degrado: -em * rhoMed * S, spiegato, residuo: bm - spiegato, n, S };

  // casi grezzi su una griglia piu' fitta: servono a gen_motore_identificazione.py per
  // SEPARARE carburante e degrado invece di assumerne uno.
  const grezzi = [];
  for (const SS of [3, 5, 8, 12]) {
    for (const c of casi(SS)) {
      const e = errori(c, {});
      if (e.length < 6) continue;
      const N = c.r.n_laps, fpl = 70.0 / N;
      let kg = 0;
      for (let k = c.L; k < c.L + c.S; k++) kg += Math.max(0, 70.0 - fpl * (k - 1));
      kg /= c.S;
      const eta = [];
      for (const d of c.presenti) {
        const x = c.r.byLap[c.L][d], st = x.stint, pas = [];
        for (let k = 1; k <= c.L; k++) {
          const y = c.r.byLap[k]?.[d];
          if (y && y.stint === st && !y.neutralized && !y.in_lap && !y.out_lap) pas.push(y.tyre_age);
        }
        if (pas.length) eta.push((x.tyre_age + c.S / 2) - mediana(pas));
      }
      grezzi.push({ gara: c.gara, L: c.L, S: c.S, bias_per_giro: mediana(e) / c.S,
                    kg, eta_extra: mediana(eta) ?? 0, n: e.length });
    }
  }
  fs.writeFileSync('./data/motore_casi_bias.json', JSON.stringify(grezzi) + '\n');
  console.log(`[scritto] data/motore_casi_bias.json (${grezzi.length} casi)`);

  fs.writeFileSync('./data/motore_appaiato.json', JSON.stringify(risultati, null, 1) + '\n');
  console.log('\n[scritto] data/motore_appaiato.json');
}
main();
