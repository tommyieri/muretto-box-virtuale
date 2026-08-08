// test_orologio.mjs — SENTINELLA DI PARITA' dell'orologio unificato.
//
// PERCHE' ESISTE, E PERCHE' PRIMA DEL CODICE. `tempoReale` e `giroDi` esistevano DUE volte
// con la stessa logica e due sorgenti di cum: in gara.html (cum reali) e in ghostplay.mjs
// (cum simulati). Unirle tocca il replay della pagina piu' vista del sito, dove una
// divergenza di interpolazione non si vede a occhio: il pallino finisce mezzo metro piu' in
// la' e nessuno se ne accorge per settimane. Questo banco congela il comportamento del
// 08/08/2026 PRIMA della modifica e pretende che il modulo nuovo lo riproduca ESATTAMENTE.
//
// I DUE `giroDi` NON ERANO IDENTICI, e la differenza non e' un caso:
//   - gara.html ancorava il giro 0 con `{lap: 0, cum: leadCum[0]}`, quindi un pilota il cui
//     primo giro noto non e' l'1 restituisce null («buco nei dati: non inventare»);
//   - ghostplay usava `{lap: fine.lap - 1, cum: leadL0}`, che al primo campione passa
//     sempre — ed e' corretto per una scena che comincia al giro di congelamento, dove il
//     giro 1 non esiste per definizione.
// Il modulo unificato le tiene entrambe con UN parametro (`lapZero`), e questo banco
// verifica che ciascun chiamante ottenga il proprio comportamento di prima.
//
// Cosa lo fa fallire (regola 4):
//   P1  tempoReale: su ogni gara e su una griglia fitta di p, il modulo deve dare lo
//       stesso valore del riferimento congelato. Tolleranza ZERO (stessa aritmetica).
//   P2  giroDi (contesto GARA): stesso {lap, fd} del riferimento su ogni pilota e ogni p,
//       compresi i null (un null che diventa un numero e' inventare un dato).
//   P3  giroDi (contesto SCENA): stesso comportamento del riferimento ghostplay, cioe'
//       il primo campione NON deve essere respinto.
//   P4  pDaTempo e' l'inverso di tempoReale entro 1e-9 sui punti interni.
//   P5  il banco ha potere: se si altera il modulo, P1/P2 devono diventare rosse. Qui si
//       verifica sul caso costruito (una perturbazione nota deve essere rilevata).

import { readFileSync } from 'node:fs';
import * as O from './orologio.mjs';

let falliti = 0;
const ok = (nome, cond, extra = '') => {
  if (cond) console.log(`   [OK  ] ${nome}${extra ? ' — ' + extra : ''}`);
  else { console.log(`   [FALLITO] ${nome}${extra ? ' — ' + extra : ''}`); falliti++; }
};
const leggi = p => JSON.parse(readFileSync(new URL(p, import.meta.url)));

// ───────────────────────── RIFERIMENTO CONGELATO (08/08/2026) ─────────────────────────
// Copie fedeli del codice che girava PRIMA dell'unificazione. NON si toccano: se un
// giorno il prodotto deve cambiare comportamento, si cambia il modulo E si riscrive
// questo blocco con una nota, non lo si aggiusta perche' il test passi.

function RIF_tempoReale_gara(leadCum, nLaps, p) {
  const L = Math.max(1, Math.min(nLaps, Math.floor(p))), f = Math.min(1, Math.max(0, p - L));
  const t0 = leadCum[L - 1], t1 = leadCum[L] ?? t0;
  if (t0 === undefined) return undefined;
  return t0 + f * (t1 - t0);
}

function RIF_giroDi_gara(cumPil, leadCum, d, T) {
  const arr = cumPil[d];
  if (!arr || !arr.length || !(T >= leadCum[0])) return null;
  let lo = 0, hi = arr.length - 1, idx = arr.length;
  if (arr[hi].cum > T) {
    while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].cum > T) hi = m; else lo = m + 1; }
    idx = lo;
  }
  if (idx >= arr.length) return null;
  const fine = arr[idx], inizio = idx > 0 ? arr[idx - 1] : { lap: 0, cum: leadCum[0] };
  if (fine.lap !== inizio.lap + 1) return null;
  const fd = (T - inizio.cum) / (fine.cum - inizio.cum || 1);
  return { lap: fine.lap, fd };
}

function RIF_giroDi_scena(cumD, leadL0, T) {
  if (!cumD || !cumD.length || !(T >= leadL0)) return null;
  let lo = 0, hi = cumD.length - 1, idx = cumD.length;
  if (cumD[hi].cum > T) {
    while (lo < hi) { const m = (lo + hi) >> 1; if (cumD[m].cum > T) hi = m; else lo = m + 1; }
    idx = lo;
  }
  if (idx >= cumD.length) return null;
  const fine = cumD[idx], inizio = idx > 0 ? cumD[idx - 1] : { lap: fine.lap - 1, cum: leadL0 };
  if (fine.lap !== inizio.lap + 1) return null;
  const fd = (T - inizio.cum) / ((fine.cum - inizio.cum) || 1);
  return { lap: fine.lap, fd: Math.min(1, Math.max(0, fd)) };
}

// ───────────────────────── i dati veri delle 11 gare ─────────────────────────

const manifest = leggi('./data/manifest.json');
let nP1 = 0, nP2 = 0, difP1 = [], difP2 = [], difP4 = [];

for (const { gara, n_laps } of manifest) {
  const dati = leggi(`./data/${gara}.json`);
  // stessa costruzione di gara.html (righe 389-400)
  const leadCum = {}, cumPil = {};
  for (const lp of dati.laps) {
    for (const [d, c] of Object.entries(lp.cars)) {
      if (typeof c.cum_time === 'number') {
        (cumPil[d] ||= []).push({ lap: lp.lap, cum: c.cum_time });
        if (leadCum[lp.lap] === undefined || c.cum_time < leadCum[lp.lap]) leadCum[lp.lap] = c.cum_time;
      }
    }
  }
  for (const d in cumPil) cumPil[d].sort((a, b) => a.lap - b.lap);
  leadCum[0] = (leadCum[1] !== undefined) ? leadCum[1] - 90 : 0;   // stima come in pagina

  const anc = O.creaAncora({ lead: leadCum, minLap: 1, maxLap: n_laps });

  for (let p = 1; p <= n_laps + 1; p += 0.037) {           // passo irrazionale: niente allineamenti comodi
    const a = RIF_tempoReale_gara(leadCum, n_laps, p);
    const b = anc.tempoDa(p);
    nP1++;
    if (!(a === b || (a === undefined && b === undefined))) {
      if (difP1.length < 5) difP1.push(`${gara} p=${p.toFixed(3)}: rif=${a} nuovo=${b}`);
    }
    if (a === undefined) continue;
    // P4: l'inverso
    const pInv = anc.pDaTempo(a);
    if (p > 1 && p < n_laps && Math.abs(pInv - p) > 1e-9 && difP4.length < 5) {
      difP4.push(`${gara} p=${p.toFixed(3)} -> T=${a.toFixed(3)} -> p'=${pInv.toFixed(6)}`);
    }
    for (const d of Object.keys(cumPil)) {
      const r = RIF_giroDi_gara(cumPil, leadCum, d, a);
      const n = O.giroDi(cumPil[d], a, { tempoZero: leadCum[0], lapZero: 0 });
      nP2++;
      const uguali = (r === null && n === null) ||
        (r && n && r.lap === n.lap && Math.abs(r.fd - n.fd) < 1e-12);
      if (!uguali && difP2.length < 6) {
        difP2.push(`${gara}/${d} T=${a.toFixed(3)}: rif=${JSON.stringify(r)} nuovo=${JSON.stringify(n)}`);
      }
    }
  }
}

ok('P1 tempoReale identico al riferimento congelato', difP1.length === 0,
   `${nP1} campioni${difP1.length ? ' · ' + difP1.join(' | ') : ''}`);
ok('P2 giroDi (contesto GARA) identico, null compresi', difP2.length === 0,
   `${nP2} campioni${difP2.length ? ' · ' + difP2.join(' | ') : ''}`);
ok('P4 pDaTempo e l\'inverso di tempoDa', difP4.length === 0,
   difP4.length ? difP4.join(' | ') : 'entro 1e-9 sui punti interni');

// ───────────────────────── P3: il contesto SCENA ─────────────────────────
// Scena che comincia al giro 30: il primo campione NON deve essere respinto, che e' la
// differenza fra i due riferimenti.
const cumScena = [{ lap: 30, cum: 3000 }, { lap: 31, cum: 3090 }, { lap: 32, cum: 3180 }];
const leadL0 = 2910;
let difP3 = [];
for (let T = 2910; T <= 3180; T += 7) {
  const r = RIF_giroDi_scena(cumScena, leadL0, T);
  const n = O.giroDi(cumScena, T, { tempoZero: leadL0, lapZero: 29, clamp: true });
  const uguali = (r === null && n === null) ||
    (r && n && r.lap === n.lap && Math.abs(r.fd - n.fd) < 1e-12);
  if (!uguali && difP3.length < 5) difP3.push(`T=${T}: rif=${JSON.stringify(r)} nuovo=${JSON.stringify(n)}`);
}
ok('P3 giroDi (contesto SCENA) identico: il primo campione non si respinge', difP3.length === 0,
   difP3.length ? difP3.join(' | ') : 'scena dal giro 30, 39 campioni');

// P3b: il contesto GARA invece DEVE respingere lo stesso pilota — ma solo dove ha senso,
// cioe' PRIMA del suo primo giro noto. Fra il giro 30 e il 31 i due campioni ci sono
// entrambi e rispondere e' giusto: e' la differenza fra «buco nei dati» e «dato che c'e'».
// Si confronta col riferimento invece di asserire un valore atteso, cosi' il caso resta
// una prova di PARITA' e non una convinzione scritta a mano.
let difP3b = [];
for (const T of [2950, 2999, 3000, 3050, 3090, 3179]) {
  const r = RIF_giroDi_gara({ X: cumScena }, { 0: 0 }, 'X', T);
  const n = O.giroDi(cumScena, T, { tempoZero: 0, lapZero: 0 });
  const uguali = (r === null && n === null) ||
    (r && n && r.lap === n.lap && Math.abs(r.fd - n.fd) < 1e-12);
  if (!uguali) difP3b.push(`T=${T}: rif=${JSON.stringify(r)} nuovo=${JSON.stringify(n)}`);
}
ok('P3b il contesto GARA si comporta come prima anche sul pilota che comincia tardi',
   difP3b.length === 0,
   difP3b.length ? difP3b.join(' | ')
     : 'prima del giro 30 respinge (buco), fra 30 e 31 risponde (dato presente)');

// ───────────────────────── P5: il banco ha potere ─────────────────────────
// Una perturbazione nota deve essere rilevata dal confronto usato in P2.
const perturbato = { lap: 5, fd: 0.5 + 1e-9 };
const sano = { lap: 5, fd: 0.5 };
ok('P5 il confronto rileva una perturbazione di 1e-9',
   !(sano.lap === perturbato.lap && Math.abs(sano.fd - perturbato.fd) < 1e-12),
   'la soglia di P2 e 1e-12: una divergenza vera non passa');

console.log(falliti ? `\nESITO: ROSSO (${falliti} falliti)` : '\nESITO: verde');
process.exit(falliti ? 1 : 0);
