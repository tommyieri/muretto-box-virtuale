// stima_rodaggio.mjs — c e tau del termine di rodaggio, come li descrive la PREREG.
//
//     node ai_lab/confronto/stima_rodaggio.mjs             referto a schermo
//     node ai_lab/confronto/stima_rodaggio.mjs --json      lo stesso, in JSON
//     node ai_lab/confronto/stima_rodaggio.mjs --scrivi    aggiorna c e tau nel modello
//
// Stima  w(eta) = -c * exp(-eta/tau)  sui giri verdi IN ARIA LIBERA, con delta e rho
// CABLATI (non ri-stimati): il rodaggio e' una forma, non una nuova taratura del modello.
//
// Il protocollo NON si decide qui: sta in PREREG_rodaggio.md, §5, scritto prima.
// Questo file lo esegue e basta. In sintesi:
//   base(gara,pilota) = mediana( r0 + c*exp(-eta/tau) )   -- la stessa mediana per blocco
//                                                            che fa `stimaBasi`
//   e                 = r0 + c*exp(-eta/tau) - base
//   perdita           = somma |e|                          -- L1, perche' la base e' una mediana
//
// PERCHE' LA GRIGLIA E NON UN OTTIMIZZATORE. La perdita e' L1 con una mediana dentro:
// non e' differenziabile e ha gradini. Una griglia dichiarata PRIMA e' verificabile; un
// ottimizzatore con punto di partenza e tolleranze non lo e'. Se il minimo cade sul bordo
// l'esito e' NULL (PREREG §7): la griglia non si allarga dopo aver visto dove e' finito.
//
// IL TRUCCO CHE RENDE ONESTO IL BOOTSTRAP. La base di un blocco (gara,pilota) dipende solo
// dai giri di quel blocco, e ogni blocco vive dentro UNA gara. Quindi la perdita e' una
// somma per gara, e basta precalcolare la matrice perdita[c][tau][gara]: da li' il fit
// pieno, gli 11 leave-one-race-out e le 2.000 ripetizioni bootstrap escono ESATTI, senza
// ri-approssimare niente. Blocchi = gare (E11).
//
// COSA SCRIVE. Niente, a meno di `--scrivi`. Con quel modo aggiorna UN SOLO blocco
// di data/modelli/modello_v2.json — c, tau, IC, leave-one-race-out, data — e non
// tocca mai `attivo`, che e' l'esito di un cancello pre-registrato. E' la forma in
// codice della regola del blocco laboratorio: il DATO si ri-stima a ogni gara, il
// VERDETTO no. Non tocca mai demo/.

import path from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { caricaGare2026 } from '../../simulatore/provenienza/gare_2026.mjs';
import { passoUtilizzabile } from '../../simulatore/provenienza/definizioni.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));
const RADICE = path.resolve(QUI, '..', '..');
const SIM = path.join(RADICE, 'simulatore');

const MODELLO = JSON.parse(readFileSync(path.join(SIM, 'data', 'modelli', 'modello_v2.json'), 'utf8'));
const RHO = MODELLO.rho.valore;
const DELTA70 = MODELLO.delta_70.scelto;
if (typeof DELTA70 !== 'number') throw new Error('il modello non ha un delta70 scelto');

// ───────────────────────────────────────────── la griglia, come la PREREG la dichiara
const C_MIN = 0.00, C_MAX = 1.50, C_PASSO = 0.01;
const T_MIN = 0.25, T_MAX = 15.00, T_PASSO = 0.25;
const SOGLIA_ARIA = 2.0;      // aria libera: gap > 2,0 s allo stesso indice di giro, o primo
const B_BOOT = 2000;
const SEME = 20260801;

const griglia = (min, max, passo) => {
  const v = [];
  for (let x = min; x <= max + 1e-9; x += passo) v.push(Number(x.toFixed(6)));
  return v;
};
const CS = griglia(C_MIN, C_MAX, C_PASSO);
const TS = griglia(T_MIN, T_MAX, T_PASSO);

const mediana = (v) => { const s = [...v].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const f = (x, n = 4) => (x === null || x === undefined || !Number.isFinite(x) ? '  —  ' : x.toFixed(n));
function rng(s0) { let s = s0 >>> 0; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// ═══════════════════════════════════════════════════════ 1 · raccolta dei giri ammessi
const gare = caricaGare2026(SIM);
const NOMI = Object.keys(gare).sort();

const ammessi = [];   // { gara, drv, eta, r0 }
let verdiTotali = 0;
for (const nome of NOMI) {
  const g = gare[nome];
  const deriva = -DELTA70 / g.nGiri;

  // gap all'auto davanti allo STESSO indice di giro (identica a fisica_sonde.mjs)
  const gapAv = new Map();
  const perGiro = new Map();
  for (const { drv, lap, cella } of g.righe) {
    if (!perGiro.has(lap)) perGiro.set(lap, []);
    perGiro.get(lap).push({ drv, cella });
  }
  for (const [lap, elenco] of perGiro) {
    const conCum = elenco.filter((x) => typeof x.cella.cum_time === 'number')
      .sort((a, b) => a.cella.cum_time - b.cella.cum_time);
    for (let i = 0; i < conCum.length; i += 1) {
      gapAv.set(`${conCum[i].drv}|${lap}`, i === 0 ? null : conCum[i].cella.cum_time - conCum[i - 1].cella.cum_time);
    }
  }

  for (const [drv, celle] of g.perPilota) {
    for (const [lap, c] of celle) {
      let ok = false;
      try { ok = passoUtilizzabile(c) && c.tyre_age !== null; } catch { ok = false; }
      if (!ok) continue;
      verdiTotali += 1;
      const gap = gapAv.get(`${drv}|${lap}`) ?? null;
      if (!(gap === null || gap > SOGLIA_ARIA)) continue;   // solo aria libera
      ammessi.push({ gara: nome, drv, eta: c.tyre_age, r0: c.lap_time - deriva * (lap - 1) - RHO * c.tyre_age });
    }
  }
}

// indici compatti: blocco = (gara,pilota) per la base, gara per i blocchi statistici
const idBlocco = new Map(); const bloccoDiGara = [];
const idGara = new Map(); NOMI.forEach((n, i) => idGara.set(n, i));
const lapBlocco = new Int32Array(ammessi.length);
const lapEta = new Int32Array(ammessi.length);
const lapR0 = new Float64Array(ammessi.length);
const lapGara = new Int32Array(ammessi.length);
ammessi.forEach((x, i) => {
  const k = `${x.gara}|${x.drv}`;
  if (!idBlocco.has(k)) { idBlocco.set(k, bloccoDiGara.length); bloccoDiGara.push(idGara.get(x.gara)); }
  lapBlocco[i] = idBlocco.get(k);
  lapEta[i] = x.eta;
  lapR0[i] = x.r0;
  lapGara[i] = idGara.get(x.gara);
});
const N_BLOCCHI = bloccoDiGara.length;
const N_GARE = NOMI.length;
const ETA_MAX = Math.max(...lapEta);

// giri raggruppati per blocco (per la mediana)
const giriDelBlocco = Array.from({ length: N_BLOCCHI }, () => []);
for (let i = 0; i < ammessi.length; i += 1) giriDelBlocco[lapBlocco[i]].push(i);

// ═══════════════════════════════════════ 2 · la matrice perdita[c][tau][gara], esatta
// Costo: |CS| * |TS| passate sui giri ammessi. exp() precalcolato per eta, una volta per tau.
const perdita = new Float64Array(CS.length * TS.length * N_GARE);
const buffer = new Float64Array(ammessi.length);
const scratch = new Float64Array(64);

function medianaDi(indici, arr) {
  const n = indici.length;
  const v = n <= scratch.length ? scratch.subarray(0, n) : new Float64Array(n);
  for (let j = 0; j < n; j += 1) v[j] = arr[indici[j]];
  const s = Array.prototype.slice.call(v).sort((a, b) => a - b);
  const m = n >> 1;
  return n % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

for (let ti = 0; ti < TS.length; ti += 1) {
  const tau = TS[ti];
  const expEta = new Float64Array(ETA_MAX + 1);
  for (let e = 0; e <= ETA_MAX; e += 1) expEta[e] = Math.exp(-e / tau);
  for (let ci = 0; ci < CS.length; ci += 1) {
    const c = CS[ci];
    for (let i = 0; i < ammessi.length; i += 1) buffer[i] = lapR0[i] + c * expEta[lapEta[i]];
    const base = new Float64Array(N_BLOCCHI);
    for (let b = 0; b < N_BLOCCHI; b += 1) base[b] = medianaDi(giriDelBlocco[b], buffer);
    const off = (ci * TS.length + ti) * N_GARE;
    for (let i = 0; i < ammessi.length; i += 1) {
      perdita[off + lapGara[i]] += Math.abs(buffer[i] - base[lapBlocco[i]]);
    }
  }
}

// argmin su un sottoinsieme (o multiset) di gare, con pesi interi
function fit(pesi) {
  let migliore = null;
  for (let ci = 0; ci < CS.length; ci += 1) {
    for (let ti = 0; ti < TS.length; ti += 1) {
      const off = (ci * TS.length + ti) * N_GARE;
      let s = 0;
      for (let gi = 0; gi < N_GARE; gi += 1) if (pesi[gi]) s += pesi[gi] * perdita[off + gi];
      if (migliore === null || s < migliore.perdita) migliore = { c: CS[ci], tau: TS[ti], perdita: s, ci, ti };
    }
  }
  return migliore;
}

const tutte = new Int32Array(N_GARE).fill(1);
const pieno = fit(tutte);

// ═══════════════════════════════════════════════════════════ 3 · leave-one-race-out
const loro = {};
for (let r = 0; r < N_GARE; r += 1) {
  const p = new Int32Array(N_GARE).fill(1); p[r] = 0;
  const m = fit(p);
  loro[NOMI[r]] = { c: m.c, tau: m.tau };
}

// ═══════════════════════════════════════════════════ 4 · bootstrap a blocchi = gare
const r = rng(SEME);
const cBoot = []; const tBoot = [];
for (let b = 0; b < B_BOOT; b += 1) {
  const p = new Int32Array(N_GARE);
  for (let i = 0; i < N_GARE; i += 1) p[Math.floor(r() * N_GARE)] += 1;
  const m = fit(p);
  cBoot.push(m.c); tBoot.push(m.tau);
}
const quant = (v, pp) => { const s = [...v].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.floor(pp * s.length)))]; };
const ic = (v) => [quant(v, 0.025), quant(v, 0.975)];
// Con 11 blocchi, un bootstrap che ri-ottimizza su una griglia salta agli estremi appena
// il ricampionamento perde le gare che identificano la forma. I quartili e la quota di
// ripetizioni che collassano a c=0 dicono quanto spesso succede: senza questi due numeri
// l'IC95 sembra "tutta la griglia" e non si capisce se e' rumore o assenza di segnale.
const quotaCollasso = cBoot.filter((x) => x <= 0.05).length / cBoot.length;

// ══════════════════════════════════ 5 · il residuo per fascia di eta, prima e dopo
function residuiCon(c, tau) {
  const w = new Float64Array(ETA_MAX + 1);
  for (let e = 0; e <= ETA_MAX; e += 1) w[e] = c * Math.exp(-e / tau);
  for (let i = 0; i < ammessi.length; i += 1) buffer[i] = lapR0[i] + w[lapEta[i]];
  const base = new Float64Array(N_BLOCCHI);
  for (let b = 0; b < N_BLOCCHI; b += 1) base[b] = medianaDi(giriDelBlocco[b], buffer);
  return Array.from({ length: ammessi.length }, (_, i) => buffer[i] - base[lapBlocco[i]]);
}
const FASCE = [[1, 1], [2, 4], [5, 8], [9, 12], [13, 20], [21, 60]];
function tabellaEta(e) {
  return FASCE.map(([a, b]) => {
    const sel = [];
    for (let i = 0; i < ammessi.length; i += 1) if (lapEta[i] >= a && lapEta[i] <= b) sel.push(e[i]);
    return { fascia: `${a}-${b}`, n: sel.length, mediana: sel.length ? mediana(sel) : null };
  });
}
const prima = tabellaEta(residuiCon(0, 1));
const dopo = tabellaEta(residuiCon(pieno.c, pieno.tau));

// ══════════════════════════════════════════════════════════════════ 6 · il referto
const sulBordo = pieno.c <= C_MIN + 1e-9 || pieno.c >= C_MAX - 1e-9
  || pieno.tau <= T_MIN + 1e-9 || pieno.tau >= T_MAX - 1e-9;
const tauLoro = Object.values(loro).map((x) => x.tau);
const fattoreTau = Math.max(...tauLoro) / Math.min(...tauLoro);

const esito = {
  targhetta: {
    tipo: 'misurato sul fondo 2026 (11 gare), giri verdi in aria libera',
    protocollo: 'ai_lab/confronto/PREREG_rodaggio.md §5 — scritto prima della stima',
    forma: 'w(eta) = -c * exp(-eta/tau), sottratto misurando e ri-aggiunto simulando',
    delta70_cablato: DELTA70,
    rho_cablato: RHO,
    aria_libera: `gap > ${SOGLIA_ARIA} s allo stesso indice di giro, o primo`,
    perdita: 'somma |e|, base = mediana per (gara,pilota) ricalcolata a ogni (c,tau)',
    griglia: { c: [C_MIN, C_MAX, C_PASSO], tau: [T_MIN, T_MAX, T_PASSO] },
    incertezza: `bootstrap ${B_BOOT}, blocchi = gare (E11), seme ${SEME}`,
    data: '2026-08-01',
  },
  perimetro: { gare: N_GARE, giri_verdi: verdiTotali, giri_in_aria_libera: ammessi.length, blocchi_gara_pilota: N_BLOCCHI },
  stima: { c: pieno.c, tau: pieno.tau, perdita_L1: pieno.perdita },
  ic95: { c: ic(cBoot), tau: ic(tBoot) },
  bootstrap_dettaglio: {
    c_quartili: [quant(cBoot, 0.25), quant(cBoot, 0.5), quant(cBoot, 0.75)],
    tau_quartili: [quant(tBoot, 0.25), quant(tBoot, 0.5), quant(tBoot, 0.75)],
    quota_ripetizioni_con_c_quasi_zero: quotaCollasso,
  },
  estrapolazione_eta_1: {
    n_osservazioni_eta_1: prima[0].n,
    w_a_eta_1: -pieno.c * Math.exp(-1 / pieno.tau),
    avvertenza: 'M1 misura la posizione al giro DOPO la sosta, dove il kernel assegna eta 1 (kernel.mjs:165-167). '
      + 'A eta 1 i giri utilizzabili sono quasi assenti (l\'out-lap e\' escluso dal filtro verde): w(1) e\' ESTRAPOLAZIONE '
      + 'della forma, non misura. Inoltre il prior di pit-loss e\' definito come (in-lap + out-lap) meno due giri di passo '
      + 'pulito, quindi una parte del beneficio della gomma nuova sull\'out-lap potrebbe gia\' essere dentro la perdita: '
      + 'sovrapposizione dichiarata, da misurare, non da assumere in un verso o nell\'altro.',
  },
  sul_bordo_della_griglia: sulBordo,
  leave_one_race_out: loro,
  stabilita_tau: { min: Math.min(...tauLoro), max: Math.max(...tauLoro), fattore: fattoreTau },
  residuo_per_eta: { prima, dopo },
};

// ══════════════════════════════════════════════ 7 · --scrivi, per l'automazione
// Il DATO si ri-stima a ogni gara, il VERDETTO no. Qui prende forma di codice:
// si aggiornano c, tau, IC, LORO e data — cioe' cio' che questo script misura —
// e NON si tocca mai `attivo`, che e' l'esito di un cancello pre-registrato
// (PREREG_rodaggio.md §6). Se domani i dati nuovi rendessero il termine dannoso,
// a spegnerlo dev'essere una persona che ha riletto il cancello, non uno script
// che gira di notte.
//
// Non scrive se il minimo cade sul bordo della griglia o se tau e' instabile fra
// i LORO: sono le condizioni di NULL della prereg, e un dato che le viola non e'
// un aggiornamento — e' un guasto da guardare.
if (process.argv.includes('--scrivi')) {
  const percorso = path.join(SIM, 'data', 'modelli', 'modello_v2.json');
  const modello = JSON.parse(readFileSync(percorso, 'utf8'));
  const prima = modello.rodaggio ?? {};
  if (sulBordo || fattoreTau > 3) {
    console.error('RODAGGIO NON SCRITTO: '
      + (sulBordo ? 'il minimo cade sul bordo della griglia' : `tau instabile fra i LORO (fattore ${fattoreTau.toFixed(2)} > 3)`)
      + ' — sono condizioni di NULL della prereg, non un aggiornamento (PREREG_rodaggio.md §7).');
    process.exit(1);
  }
  modello.rodaggio = {
    ...prima,
    attivo: prima.attivo === true,          // MAI deciso qui
    c: pieno.c,
    tau: pieno.tau,
    ic95: {
      c: ic(cBoot), tau: ic(tBoot),
      quartili_c: [quant(cBoot, 0.25), quant(cBoot, 0.5), quant(cBoot, 0.75)],
      quartili_tau: [quant(tBoot, 0.25), quant(tBoot, 0.5), quant(tBoot, 0.75)],
      avvertenza: prima.ic95?.avvertenza ?? null,
      quota_ripetizioni_collassate: quotaCollasso,
    },
    leave_one_race_out: Object.fromEntries(NOMI.map((n) => [n, { c: loro[n].c, tau: loro[n].tau }])),
    gare: N_GARE,
    giri_in_aria_libera: ammessi.length,
    data: process.argv.includes('--data') ? process.argv[process.argv.indexOf('--data') + 1] : esito.targhetta.data,
  };
  writeFileSync(percorso, `${JSON.stringify(modello, null, 2)}\n`);
  const mosso = prima.c !== pieno.c || prima.tau !== pieno.tau;
  console.log(`rodaggio scritto in data/modelli/modello_v2.json: c ${prima.c ?? '—'} -> ${pieno.c}, tau ${prima.tau ?? '—'} -> ${pieno.tau}`
    + `  (attivo resta ${modello.rodaggio.attivo}, il cancello non si rigira qui)`);
  if (mosso) console.log('  i parametri SI SONO MOSSI: le viste vanno risincronizzate (web/genera_vista_gara.mjs --sincronizza)');
} else if (process.argv.includes('--json')) {
  console.log(JSON.stringify(esito, null, 2));
} else {
  console.log('STIMA DEL RODAGGIO — w(eta) = -c * exp(-eta/tau)');
  console.log(`  protocollo: PREREG_rodaggio.md §5 (scritto prima)  ·  delta70 ${DELTA70} e rho ${RHO} CABLATI, non ri-stimati`);
  console.log(`  perimetro: ${N_GARE} gare · ${verdiTotali} giri verdi · ${ammessi.length} in aria libera (>${SOGLIA_ARIA} s) · ${N_BLOCCHI} blocchi (gara,pilota)`);
  console.log(`  griglia: c ${C_MIN}..${C_MAX} passo ${C_PASSO} (${CS.length}) · tau ${T_MIN}..${T_MAX} passo ${T_PASSO} (${TS.length})`);
  console.log('');
  console.log(`  STIMA PIENA (dentro campione):  c = ${f(pieno.c)} s   tau = ${f(pieno.tau, 2)} giri`);
  console.log(`  IC95 bootstrap a blocchi=gare: c [${f(ic(cBoot)[0])}; ${f(ic(cBoot)[1])}]  ·  tau [${f(ic(tBoot)[0], 2)}; ${f(ic(tBoot)[1], 2)}]`);
  console.log(`    quartili   c [${f(quant(cBoot, 0.25))} | ${f(quant(cBoot, 0.5))} | ${f(quant(cBoot, 0.75))}]  ·  tau [${f(quant(tBoot, 0.25), 2)} | ${f(quant(tBoot, 0.5), 2)} | ${f(quant(tBoot, 0.75), 2)}]`);
  console.log(`    ripetizioni che collassano a c<=0,05: ${(100 * quotaCollasso).toFixed(1)}%  ·  con 11 blocchi il bootstrap ri-ottimizza su una griglia e salta agli estremi`);
  console.log(`  minimo sul BORDO della griglia: ${sulBordo ? 'SI — la forma non e\' identificata, esito NULL (PREREG §7)' : 'no'}`);
  console.log(`  w al primo giro utile: w(2) = ${f(-pieno.c * Math.exp(-2 / pieno.tau))} s/giro · w(8) = ${f(-pieno.c * Math.exp(-8 / pieno.tau))} · w(15) = ${f(-pieno.c * Math.exp(-15 / pieno.tau))}`);
  console.log(`  ATTENZIONE — w(1) = ${f(-pieno.c * Math.exp(-1 / pieno.tau))} s e' ESTRAPOLAZIONE: a eta 1 ci sono ${prima[0].n} giri utilizzabili in tutto il fondo`);
  console.log(`    ed e' proprio il giro su cui M1 misura (il kernel assegna eta 1 al giro dopo la sosta). Vedi 'estrapolazione_eta_1' nel JSON.`);
  console.log('');
  console.log('  LEAVE-ONE-RACE-OUT (i parametri che valuteranno la gara esclusa)');
  for (const n of NOMI) console.log(`    senza ${n.padEnd(15)} c = ${f(loro[n].c)}   tau = ${f(loro[n].tau, 2)}`);
  console.log(`    stabilita' di tau: min ${f(Math.min(...tauLoro), 2)} · max ${f(Math.max(...tauLoro), 2)} · fattore ${f(fattoreTau, 2)} (NULL se > 3, PREREG §7)`);
  console.log('');
  console.log('  RESIDUO MEDIANO PER FASCIA DI ETA (aria libera) — se la forma e\' giusta, la colonna "dopo" e\' piatta');
  console.log('    fascia        n        prima      dopo');
  for (let i = 0; i < FASCE.length; i += 1) {
    console.log(`    ${prima[i].fascia.padEnd(10)} ${String(prima[i].n).padStart(6)}   ${f(prima[i].mediana).padStart(9)} ${f(dopo[i].mediana).padStart(9)}`);
  }
}
