// M1a — ERRORE DI POSIZIONE AL RIENTRO, sulle soste vere.
//
//   node ai_lab/confronto/M1a_errore_posizione.mjs           il referto
//   node ai_lab/confronto/M1a_errore_posizione.mjs --json    lo stesso, in JSON
//
// Misura pre-registrata in ai_lab/confronto/PREREG_confronto_motori.md (M1):
// mediana di |previsto − reale|, quota di esatti, quota entro 1, ripartizione PER GARA,
// distribuzione degli errori CON SEGNO, e i muti contati a parte per ciascun motore.
//
// ————————————————————————————————————————————————————————————————————————————
// DUE LETTURE, ENTRAMBE RIPORTATE, PERCHE' LA PREREG NON SCEGLIE (P2 del collaudo)
// ————————————————————————————————————————————————————————————————————————————
// `pos` e' un RANGO dentro una popolazione, e le tre popolazioni (vecchio, nuovo, verita')
// non coincidono: al vecchio manca chi non ha un passo, il nuovo e la verita' hanno campi
// diversi ancora. Quindi:
//
//   LETTURA A (grezza)  |pos − posizioneVera|          — i due campi che il banco consegna.
//                       Misura il motore E il denominatore insieme.
//   LETTURA B (comune)  le DUE previsioni e la VERITA' ri-classificate sull'intersezione
//                       delle tre popolazioni. Misura solo l'ordine, a parita' di campo.
//
// Nessuna delle due e' "quella giusta" per decreto: A e' cio' che il prodotto mostra
// all'utente (P8 su 20 e' il numero che compare), B e' cio' che isola la fisica. Si
// riportano entrambe e il cancello si legge su entrambe. Se dissentono, si dice.
//
// ————————————————————————————————————————————————————————————————————————————
// TRE CONFIGURAZIONI DEL MOTORE VECCHIO (P1 del collaudo)
// ————————————————————————————————————————————————————————————————————————————
// Il banco copia `gen_hero.mjs`, che non passa mai `passo`. Ma il motore che stava sulla
// pagina-gara e' `demo/muretto.mjs`, che dal 28/07 passa `passo = {delta, rho}` da
// `demo/data/modello_passo_2026.json`. Per M1 misuro entrambi:
//
//   V-banco   byLap troncato · orizzonte 0 · passo = null     (la configurazione del banco)
//   V-pannello byLap troncato · orizzonte 0 · passo = v2      (il modello che era in prod,
//                                                              ma valutato allo STESSO giro)
//   V-prod-letterale byLap INTERO · orizzonte 5 · passo = v2  (la produzione alla lettera:
//                                                              sbircia il futuro E risponde
//                                                              al giro pit+6 — NON confrontabile
//                                                              con una verita' presa al pit+1.
//                                                              Riportata solo come contesto.)
//
// Il confronto col nuovo si legge su V-banco e V-pannello, che rispondono allo stesso giro
// del nuovo (`giroFinale = giroPit + 1`) e non leggono nulla oltre il congelamento.
//
// ————————————————————————————————————————————————————————————————————————————
// COSE CHE SPORCANO IL NUMERO E VANNO LETTE INSIEME AL NUMERO
// ————————————————————————————————————————————————————————————————————————————
//  - I due motori ricevono PIT-LOSS DIVERSI (tabella del sito contro prior del simulatore,
//    fino a 5 s di scarto). Una fetta di qualunque scarto e' la tabella, non il motore.
//  - Circolarita' in-sample da entrambe le parti: `pitloss.json` di GB e Miami e'
//    'realizzato' (misurato a gara finita su quella stessa gara); `modello_v2.json` e
//    `banda_rientro.json` del nuovo sono calibrati su queste 11 gare.
//  - Il perimetro esclude 140 soste come 'doppiato al rientro', 46 delle quali lo diventano
//    PER EFFETTO della sosta: mancano sistematicamente le soste che costano un giro.
//
// Questo file non scrive niente su disco e non tocca demo/, simulatore/, data/.

import {
  casi, censimento, rispostaVecchio, rispostaNuovo, gare,
} from './banco.mjs';

const JSON_OUT = process.argv.includes('--json');

// ————————————————————————————————————————————————————————————————— statistica
const mediana = (v) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const quota = (v, f) => (v.length ? v.filter(f).length / v.length : null);
const pct = (x) => (x === null ? '  —  ' : `${(100 * x).toFixed(1)}%`);
const num = (x, d = 2) => (x === null || x === undefined ? '—' : x.toFixed(d));
const segno = (x) => (x === null ? '—' : (x >= 0 ? `+${x.toFixed(2)}` : x.toFixed(2)));

/** Il pacchetto di numeri di M1 su un elenco di errori interi. */
function riassunto(errori) {
  const ass = errori.map(Math.abs);
  return {
    n: errori.length,
    mediana_ass: mediana(ass),
    media_ass: media(ass),
    esatti: quota(ass, (e) => e === 0),
    entro1: quota(ass, (e) => e <= 1),
    entro2: quota(ass, (e) => e <= 2),
    n_esatti: ass.filter((e) => e === 0).length,
    n_entro1: ass.filter((e) => e <= 1).length,
    mediana_segno: mediana(errori),
    media_segno: media(errori),
    sovrastima: quota(errori, (e) => e > 0),   // pos previsto PIU' ALTO = piu' indietro
    sottostima: quota(errori, (e) => e < 0),
    max_ass: ass.length ? Math.max(...ass) : null,
  };
}

/** Istogramma degli errori con segno, chiavi ordinate. */
function istogramma(errori) {
  const h = new Map();
  for (const e of errori) h.set(e, (h.get(e) ?? 0) + 1);
  return [...h.entries()].sort((a, b) => a[0] - b[0]);
}

// ——————————————————————————————————— la ri-classificazione sulla popolazione comune
/**
 * LETTURA B. Prende l'ordine previsto dai due motori e l'ordine vero, tiene solo le sigle
 * presenti in TUTTI E TRE, e ri-conta il rango del pilota dentro quell'insieme.
 * Nessun numero viene inventato: si riusa l'ordinamento che ogni motore ha gia' prodotto.
 */
function letturaComune(caso, ordVecchio, ordNuovo) {
  if (!ordVecchio || !ordNuovo) return null;
  const sv = new Set(ordVecchio.map((x) => x[0]));
  const sn = new Set(ordNuovo.map((x) => x[0]));
  const comune = caso.ordineVero.filter((d) => sv.has(d) && sn.has(d));
  if (!comune.includes(caso.pilota)) return null;
  const S = new Set(comune);
  const rango = (lista) => lista.filter((d) => S.has(d)).indexOf(caso.pilota) + 1;
  return {
    su: comune.length,
    vero: rango(caso.ordineVero),
    vecchio: rango(ordVecchio.map((x) => x[0])),
    nuovo: rango(ordNuovo.map((x) => x[0])),
  };
}

// ————————————————————————————————————————————————————————— il modello di passo v2
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { RADICE } from './banco.mjs';
const MP = JSON.parse(readFileSync(path.join(RADICE, 'demo', 'data', 'modello_passo_2026.json'), 'utf8'));
const PASSO_V2 = { delta: MP.deriva.delta_gara_s, rho: MP.degrado.rho_s_giro };

// `rispostaVecchio` non espone `passo`: lo si passa costruendo gli argomenti con
// `ingressiVecchio` (che e' proprio la porta che il banco apre per questo) e chiamando
// `evaluatePit` con gli stessi identici ingressi piu' `passo`.
import { ingressiVecchio } from './banco.mjs';
import { evaluatePit } from '../../demo/pitscenario.mjs';
function vecchioConPasso(caso, { troncato = true, orizzonte = 0, passo = null } = {}) {
  const ing = ingressiVecchio(caso, { troncato, orizzonte });
  // col passo v2 il pannello SPEGNE il gradino (altrimenti lo conta due volte)
  const arg = { ...ing.argomenti, passo, gradino: passo ? null : ing.argomenti.gradino };
  let r;
  try { r = evaluatePit(arg); } catch (e) { return { ok: false, muto: true, motivo: `eccezione: ${e.message}`, pos: null, su: null, ordine: null }; }
  if (!r || r.ok !== true) return { ok: false, muto: true, motivo: r?.reason ?? 'nessuna risposta', pos: null, su: null, ordine: null };
  return { ok: true, muto: false, motivo: null, pos: r.rientro_pos, su: r.su_totale, ordine: r.ordine_previsto };
}

// ————————————————————————————————————————————————————————————————————— la misura
const elenco = casi();
const cens = censimento();

const righe = [];
for (const c of elenco) {
  const v = rispostaVecchio(c);                                    // V-banco
  const vp = vecchioConPasso(c, { passo: PASSO_V2 });              // V-pannello
  const vl = vecchioConPasso(c, { troncato: false, orizzonte: 5, passo: PASSO_V2 }); // letterale
  const n = rispostaNuovo(c);
  const B = (!v.muto && !n.muto) ? letturaComune(c, v.ordine, n.ordine) : null;
  const Bp = (!vp.muto && !n.muto) ? letturaComune(c, vp.ordine, n.ordine) : null;
  righe.push({
    id: c.id, gara: c.gara, pilota: c.pilota, pitLap: c.pitLap,
    vera: c.posizioneVera, suVeri: c.suQuantiVeri,
    v, vp, vl, n, B, Bp,
    errA_v: v.muto ? null : v.pos - c.posizioneVera,
    errA_vp: vp.muto ? null : vp.pos - c.posizioneVera,
    errA_vl: vl.muto ? null : vl.pos - c.posizioneVera,
    errA_n: n.muto ? null : n.pos - c.posizioneVera,
    errB_v: B ? B.vecchio - B.vero : null,
    errB_n: B ? B.nuovo - B.vero : null,
    errB_vp: Bp ? Bp.vecchio - Bp.vero : null,
    errB_np: Bp ? Bp.nuovo - Bp.vero : null,
  });
}

// insiemi di casi
const entrambi = righe.filter((r) => !r.v.muto && !r.n.muto);          // V-banco e nuovo
const entrambiP = righe.filter((r) => !r.vp.muto && !r.n.muto);        // V-pannello e nuovo

const M = {
  // lettura A, ciascuno sul PROPRIO insieme di risposte
  A_vecchio_tutti: riassunto(righe.filter((r) => r.errA_v !== null).map((r) => r.errA_v)),
  A_nuovo_tutti: riassunto(righe.filter((r) => r.errA_n !== null).map((r) => r.errA_n)),
  // lettura A, sui casi in cui rispondono ENTRAMBI (il confronto leale)
  A_vecchio: riassunto(entrambi.map((r) => r.errA_v)),
  A_nuovo: riassunto(entrambi.map((r) => r.errA_n)),
  // lettura B, stessi casi, popolazione comune
  B_vecchio: riassunto(entrambi.filter((r) => r.errB_v !== null).map((r) => r.errB_v)),
  B_nuovo: riassunto(entrambi.filter((r) => r.errB_n !== null).map((r) => r.errB_n)),
  // V-pannello (passo v2)
  A_vecchioP: riassunto(entrambiP.map((r) => r.errA_vp)),
  A_nuovoP: riassunto(entrambiP.map((r) => r.errA_n)),
  B_vecchioP: riassunto(entrambiP.filter((r) => r.errB_vp !== null).map((r) => r.errB_vp)),
  B_nuovoP: riassunto(entrambiP.filter((r) => r.errB_np !== null).map((r) => r.errB_np)),
  // produzione letterale (non confrontabile: risponde al giro pit+6)
  A_vecchioL: riassunto(righe.filter((r) => r.errA_vl !== null).map((r) => r.errA_vl)),
};

// muti
const mutiV = righe.filter((r) => r.v.muto);
const mutiN = righe.filter((r) => r.n.muto);
const mutiVP = righe.filter((r) => r.vp.muto);
const motiviDi = (l) => {
  const h = new Map();
  for (const r of l) {
    const m = (r.motivo ?? '').replace(/\d+[.,]\d+/g, 'X').slice(0, 90);
    h.set(m, (h.get(m) ?? 0) + 1);
  }
  return [...h.entries()].sort((a, b) => b[1] - a[1]);
};

// per gara (blocchi = gare: nessuna media fra gare senza dirlo)
const perGara = [];
for (const g of gare()) {
  const dg = entrambi.filter((r) => r.gara === g);
  const tot = righe.filter((r) => r.gara === g);
  const rv = riassunto(dg.map((r) => r.errA_v));
  const rn = riassunto(dg.map((r) => r.errA_n));
  const bv = riassunto(dg.filter((r) => r.errB_v !== null).map((r) => r.errB_v));
  const bn = riassunto(dg.filter((r) => r.errB_n !== null).map((r) => r.errB_n));
  perGara.push({
    gara: g, casi: tot.length, entrambi: dg.length,
    muti_v: tot.filter((r) => r.v.muto).length, muti_n: tot.filter((r) => r.n.muto).length,
    A_v: rv, A_n: rn, B_v: bv, B_n: bn,
  });
}

// popolazioni: quanto sono diversi i denominatori
const popo = {
  n: entrambi.length,
  su_v_diverso_vero: entrambi.filter((r) => r.v.su !== r.suVeri).length,
  su_n_diverso_vero: entrambi.filter((r) => r.n.su !== r.suVeri).length,
  tutti_uguali: entrambi.filter((r) => r.v.su === r.suVeri && r.n.su === r.suVeri).length,
  mediana_su_vero: mediana(entrambi.map((r) => r.suVeri)),
  mediana_su_v: mediana(entrambi.map((r) => r.v.su)),
  mediana_su_n: mediana(entrambi.map((r) => r.n.su)),
  mediana_su_comune: mediana(entrambi.filter((r) => r.B).map((r) => r.B.su)),
};

// testa a testa per caso (lettura A e B), sui casi con entrambe le risposte
const testa = (chiaveV, chiaveN, sub = entrambi) => {
  let v = 0, n = 0, pari = 0;
  for (const r of sub) {
    if (r[chiaveV] === null || r[chiaveN] === null) continue;
    const a = Math.abs(r[chiaveV]), b = Math.abs(r[chiaveN]);
    if (b < a) n += 1; else if (a < b) v += 1; else pari += 1;
  }
  return { vince_nuovo: n, vince_vecchio: v, pari };
};

// cancello M1 come pre-registrato: mediana <= vecchio E esatti >= vecchio
const cancello = (V, N) => ({
  mediana_ok: N.mediana_ass <= V.mediana_ass,
  esatti_ok: N.esatti >= V.esatti,
  passa: N.mediana_ass <= V.mediana_ass && N.esatti >= V.esatti,
});

const esito = {
  A: cancello(M.A_vecchio, M.A_nuovo),
  B: cancello(M.B_vecchio, M.B_nuovo),
  A_pannello: cancello(M.A_vecchioP, M.A_nuovoP),
  B_pannello: cancello(M.B_vecchioP, M.B_nuovoP),
};

// ————————————————————————————————————————————————————————————————————— referto
if (JSON_OUT) {
  console.log(JSON.stringify({ censimento: cens, M, esito, perGara, popo,
    muti: { vecchio: mutiV.length, nuovo: mutiN.length, vecchio_pannello: mutiVP.length,
            motivi_vecchio: motiviDi(mutiV.map((r) => r.v)), motivi_nuovo: motiviDi(mutiN.map((r) => r.n)) },
    testa: { A: testa('errA_v', 'errA_n'), B: testa('errB_v', 'errB_n') },
    istogrammi: { A_vecchio: istogramma(entrambi.map((r) => r.errA_v)),
                  A_nuovo: istogramma(entrambi.map((r) => r.errA_n)),
                  B_vecchio: istogramma(entrambi.filter((r) => r.B).map((r) => r.errB_v)),
                  B_nuovo: istogramma(entrambi.filter((r) => r.B).map((r) => r.errB_n)) },
  }, null, 1));
  process.exit(0);
}

const R = (et, x) => `  ${et.padEnd(22)} n=${String(x.n).padStart(3)}  mediana|e| ${num(x.mediana_ass, 1).padStart(4)}  media|e| ${num(x.media_ass).padStart(5)}`
  + `  esatti ${pct(x.esatti)} (${x.n_esatti})  entro1 ${pct(x.entro1)} (${x.n_entro1})  entro2 ${pct(x.entro2)}`
  + `  err.segno med ${segno(x.media_segno)}  max|e| ${x.max_ass}`;

console.log('M1 — ERRORE DI POSIZIONE AL RIENTRO SULLE SOSTE VERE');
console.log('='.repeat(100));
console.log(`\nPERIMETRO: ${cens.ammessi} casi ammessi su ${cens.soste_reali_trovate} soste reali`);
for (const [k, v] of Object.entries(cens.esclusi)) console.log(`   escluse · ${k.padEnd(28)} ${v}`);

console.log(`\nMUTI (contati, non scartati)`);
console.log(`   VECCHIO (V-banco)    ${mutiV.length}/${righe.length}`);
for (const [m, k] of motiviDi(mutiV.map((r) => r.v))) console.log(`        ${String(k).padStart(3)} × ${m}`);
console.log(`   VECCHIO (V-pannello) ${mutiVP.length}/${righe.length}`);
console.log(`   NUOVO                ${mutiN.length}/${righe.length}`);
for (const [m, k] of motiviDi(mutiN.map((r) => r.n))) console.log(`        ${String(k).padStart(3)} × ${m}`);
console.log(`   casi con risposta da ENTRAMBI (V-banco):    ${entrambi.length}`);
console.log(`   casi con risposta da ENTRAMBI (V-pannello): ${entrambiP.length}`);

console.log(`\nI DENOMINATORI NON COINCIDONO (perche' servono due letture) — sui ${popo.n} casi comuni`);
console.log(`   su(vecchio) != su(verita') in ${popo.su_v_diverso_vero}  ·  su(nuovo) != su(verita') in ${popo.su_n_diverso_vero}  ·  tutti e tre uguali in ${popo.tutti_uguali}`);
console.log(`   ampiezza mediana del campo: verita' ${popo.mediana_su_vero} · vecchio ${popo.mediana_su_v} · nuovo ${popo.mediana_su_n} · intersezione ${popo.mediana_su_comune}`);

console.log(`\n${'—'.repeat(100)}\nLETTURA A — |pos − posizioneVera|, i campi che il banco consegna`);
console.log(R('VECCHIO (tutti i suoi)', M.A_vecchio_tutti));
console.log(R('NUOVO   (tutti i suoi)', M.A_nuovo_tutti));
console.log('   — sugli stessi casi (entrambi rispondono) —');
console.log(R('VECCHIO V-banco', M.A_vecchio));
console.log(R('NUOVO', M.A_nuovo));
console.log(`   testa a testa per caso: nuovo ${testa('errA_v', 'errA_n').vince_nuovo} · vecchio ${testa('errA_v', 'errA_n').vince_vecchio} · pari ${testa('errA_v', 'errA_n').pari}`);
console.log(`   CANCELLO M1 (mediana ≤ e esatti ≥): ${esito.A.passa ? 'PASSA' : 'NON PASSA'}  [mediana ${esito.A.mediana_ok} · esatti ${esito.A.esatti_ok}]`);

console.log(`\nLETTURA B — le due previsioni e la verita' ri-classificate sull'intersezione`);
console.log(R('VECCHIO V-banco', M.B_vecchio));
console.log(R('NUOVO', M.B_nuovo));
console.log(`   testa a testa per caso: nuovo ${testa('errB_v', 'errB_n').vince_nuovo} · vecchio ${testa('errB_v', 'errB_n').vince_vecchio} · pari ${testa('errB_v', 'errB_n').pari}`);
console.log(`   CANCELLO M1: ${esito.B.passa ? 'PASSA' : 'NON PASSA'}  [mediana ${esito.B.mediana_ok} · esatti ${esito.B.esatti_ok}]`);

console.log(`\n${'—'.repeat(100)}\nIL VECCHIO COM'ERA IN PRODUZIONE (passo v2 acceso, stesso giro di risposta)`);
console.log(R('VECCHIO V-pannello A', M.A_vecchioP));
console.log(R('NUOVO (stessi casi) A', M.A_nuovoP));
console.log(`   CANCELLO M1 lettura A: ${esito.A_pannello.passa ? 'PASSA' : 'NON PASSA'}`);
console.log(R('VECCHIO V-pannello B', M.B_vecchioP));
console.log(R('NUOVO (stessi casi) B', M.B_nuovoP));
console.log(`   CANCELLO M1 lettura B: ${esito.B_pannello.passa ? 'PASSA' : 'NON PASSA'}`);
console.log(`\n   contesto, NON confrontabile (risponde al giro pit+6 e legge byLap intero):`);
console.log(R('V-prod-letterale', M.A_vecchioL));

console.log(`\n${'—'.repeat(100)}\nERRORI CON SEGNO (positivo = il motore mette il pilota PIU' INDIETRO del vero)`);
for (const [et, err] of [['A vecchio', entrambi.map((r) => r.errA_v)], ['A nuovo', entrambi.map((r) => r.errA_n)],
                         ['B vecchio', entrambi.filter((r) => r.B).map((r) => r.errB_v)],
                         ['B nuovo', entrambi.filter((r) => r.B).map((r) => r.errB_n)]]) {
  const x = riassunto(err);
  console.log(`  ${et.padEnd(12)} media ${segno(x.media_segno)}  mediana ${segno(x.mediana_segno)}  sovrastima(+) ${pct(x.sovrastima)}  sottostima(−) ${pct(x.sottostima)}  esatti ${pct(x.esatti)}`);
  console.log(`               istogramma: ${istogramma(err).map(([k, v]) => `${k >= 0 ? '+' : ''}${k}:${v}`).join('  ')}`);
}

console.log(`\n${'—'.repeat(100)}\nPER GARA (blocchi = gare; nessuna media fra gare)`);
console.log('  gara              casi  ent.  muti(v/n) | A: med|e| v→n   esatti v→n      | B: med|e| v→n   esatti v→n');
for (const p of perGara) {
  console.log(`  ${p.gara.padEnd(16)} ${String(p.casi).padStart(4)} ${String(p.entrambi).padStart(5)}  ${String(p.muti_v).padStart(3)}/${String(p.muti_n).padStart(3)}   |`
    + `  ${num(p.A_v.mediana_ass, 1).padStart(4)}→${num(p.A_n.mediana_ass, 1).padStart(4)}`
    + `   ${pct(p.A_v.esatti)}→${pct(p.A_n.esatti)}  |`
    + `  ${num(p.B_v.mediana_ass, 1).padStart(4)}→${num(p.B_n.mediana_ass, 1).padStart(4)}`
    + `   ${pct(p.B_v.esatti)}→${pct(p.B_n.esatti)}`);
}
const vinceGaraA = perGara.filter((p) => p.entrambi > 0 && p.A_n.mediana_ass < p.A_v.mediana_ass).length;
const pariGaraA = perGara.filter((p) => p.entrambi > 0 && p.A_n.mediana_ass === p.A_v.mediana_ass).length;
const vinceGaraB = perGara.filter((p) => p.entrambi > 0 && p.B_n.mediana_ass < p.B_v.mediana_ass).length;
const pariGaraB = perGara.filter((p) => p.entrambi > 0 && p.B_n.mediana_ass === p.B_v.mediana_ass).length;
console.log(`  gare in cui la mediana del NUOVO e' migliore — lettura A: ${vinceGaraA}/11 (pari ${pariGaraA}) · lettura B: ${vinceGaraB}/11 (pari ${pariGaraB})`);
const espA = perGara.filter((p) => p.entrambi > 0 && p.A_n.esatti > p.A_v.esatti).length;
const espB = perGara.filter((p) => p.entrambi > 0 && p.B_n.esatti > p.B_v.esatti).length;
console.log(`  gare in cui gli esatti del NUOVO sono piu' — lettura A: ${espA}/11 · lettura B: ${espB}/11`);
