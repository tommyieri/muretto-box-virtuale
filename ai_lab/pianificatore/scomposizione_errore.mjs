#!/usr/bin/env node
// scomposizione_errore.mjs — i sette giri, scomposti: e' il numero di soste o il giro?
//
//     node ai_lab/pianificatore/scomposizione_errore.mjs [--json]
//
// NON DECIDE e NON ACCENDE: esegue la diagnosi di PREREG_scomposizione_errore.md e legge
// il risultato con la regola gia' scritta li' (Delta >= 2 giri, <= 0,5, o in mezzo).
//
// I TRE BRACCI si leggono da UNA sola chiamata a `pianoOttimo`, perche' quella gia' valuta
// tutti i k e li restituisce in `per_k`:
//   A  libero      il piano che il motore sceglie davvero — il prodotto di oggi
//   B  k imposto   lo stesso motore, al numero di soste VERO
//   C  pavimento   la tabella di tre numeri (vita per mescola), leave-one-race-out
//
// B NON E' UN CANDIDATO ALLA PRODUZIONE: riceve dal futuro il numero di soste, e nessun
// prodotto lo conosce in anticipo. Serve solo a dividere la colpa fra le due scelte.
//
// COSA LO FA USCIRE 1:
//   (a) il perimetro non e' quello del banco delle decisioni;
//   (b) il braccio A non riproduce il motore di oggi — cioe' lo strumento non e' tarato.

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { RADICE, gare, garaSimDi, contestoNuovo } from '../confronto/banco.mjs';
import { testSegni, mediana } from '../confronto/bandiera.mjs';
import { decisioni, vitaDa, vitaCieca } from '../degrado/decisioni.mjs';
import { stintConclusi } from '../degrado/durate.mjs';
import { pianoOttimo } from '../../simulatore/scenario/piano.mjs';

const JSON_OUT = process.argv.includes('--json');
const stampa = (s = '') => { if (!JSON_OUT) console.log(s); };

// Soglie di lettura da PREREG_scomposizione_errore.md §5. NON si toccano qui.
const DELTA_K = 2;
const DELTA_GIRO = 0.5;

const D = decisioni();

const righe = [];
const persi = {};
let senzaKvero = 0;
for (const gara of gare()) {
  const mie = D.filter((x) => x.gara === gara);
  if (!mie.length) continue;
  const vitaLoo = vitaDa(D, gara);
  const ciecaLoo = vitaCieca(D, gara);
  const ctx = { ...contestoNuovo(gara), vitaMescola: { attivo: true, giri: vitaLoo, natura: 'PRIOR_COMPORTAMENTALE' } };
  const g = ctx.gare[garaSimDi(gara)];

  // LE SOSTE VERE, per pilota. Si contano su TUTTI gli stint conclusi da una sosta, senza
  // filtrare per mescola: una sosta e' una sosta anche se monta l'intermedia, e qui serve
  // il numero di volte che il pilota e' entrato ai box, non la sua storia di gomme.
  const sostePer = new Map();
  for (const s of stintConclusi(g.perPilota, { gara })) {
    if (!sostePer.has(s.drv)) sostePer.set(s.drv, []);
    sostePer.get(s.drv).push(s.giro_sosta);
  }

  for (const d of mie) {
    let p;
    try {
      p = pianoOttimo({ gara: garaSimDi(gara), freezeLap: d.giro_inizio, pilota: d.drv, giroFinale: g.nGiri },
        { ...ctx, nGiriGara: g.nGiri });
    } catch (e) { persi[`eccezione: ${e.message.slice(0, 30)}`] = (persi[`eccezione: ${e.message.slice(0, 30)}`] ?? 0) + 1; continue; }
    if (!p?.migliore) { persi['nessun piano: passo base assente al giro d\'inizio'] = (persi['nessun piano: passo base assente al giro d\'inizio'] ?? 0) + 1; continue; }

    const durataDa = (soste) => (soste.length ? soste[0] - d.giro_inizio : g.nGiri - d.giro_inizio);

    // A · libero
    const sosteA = p.migliore.piano.soste.map((s) => s.giro);
    const kA = sosteA.length;

    // il k VERO: quante soste ha fatto davvero da qui alla bandiera
    const kVero = (sostePer.get(d.drv) ?? []).filter((giro) => giro >= d.giro_inizio).length;

    // B · k imposto — si legge da per_k, senza rieseguire niente
    const voceB = p.per_k.find((x) => x.k === kVero && Array.isArray(x.soste) && x.totale !== null);
    if (!voceB) senzaKvero += 1;

    // C · pavimento
    const c = vitaLoo[d.mescola] ?? ciecaLoo;

    righe.push({
      gara, drv: d.drv, mescola: d.mescola, vera: d.durata,
      k_motore: kA, k_vero: kVero,
      a: durataDa(sosteA),
      b: voceB ? durataDa(voceB.soste) : null,
      c,
      arrivi_a: kA === 0,
      arrivi_b: voceB ? voceB.soste.length === 0 : null,
    });
  }
}

if (!righe.length) { console.error('perimetro vuoto: non giudico.'); process.exit(1); }
for (const r of righe) {
  r.e_a = Math.abs(r.a - r.vera);
  r.e_b = r.b === null ? null : Math.abs(r.b - r.vera);
  r.e_c = Math.abs(r.c - r.vera);
}

const conB = righe.filter((r) => r.e_b !== null);
const medA = mediana(righe.map((r) => r.e_a));
const medC = mediana(righe.map((r) => r.e_c));
// A e B si confrontano SOLO sulle decisioni dove B esiste, altrimenti sarebbero due
// popolazioni diverse e la differenza sarebbe del perimetro, non dei bracci.
const medAsuB = mediana(conB.map((r) => r.e_a));
const medB = mediana(conB.map((r) => r.e_b));
const medCsuB = mediana(conB.map((r) => r.e_c));
const DELTA = medAsuB - medB;

stampa('');
stampa('══ SCOMPOSIZIONE DEI SETTE GIRI — PREREG_scomposizione_errore.md ═══════════');
stampa(`   ${righe.length} decisioni misurabili · ${Object.values(persi).reduce((a, b) => a + b, 0)} non misurabili`);
for (const [m, k] of Object.entries(persi).sort((x, y) => y[1] - x[1])) stampa(`       ${String(k).padStart(3)}  ${m}`);
stampa('');
stampa(`   sull'intero perimetro (${righe.length}):   A libero ${medA}   ·   C pavimento ${medC}`);
stampa(`   dove B esiste (${conB.length}):          A ${medAsuB}   ·   B k imposto ${medB}   ·   C ${medCsuB}`);
stampa(`   decisioni senza k vero in per_k: ${senzaKvero} (k vero oltre kMax, o nessun piano valido a quel k)`);
stampa('');
stampa(`   Δ = mediana(A) − mediana(B) = ${DELTA.toFixed(2)} giri`);

// ── la matrice di confusione, riportata comunque (prereg §6) ────────────────
const ks = [...new Set([...righe.map((r) => r.k_motore), ...righe.map((r) => r.k_vero)])].sort((a, b) => a - b);
stampa('');
stampa('   matrice di confusione — righe: k del MOTORE, colonne: k VERO');
stampa(`        ${ks.map((k) => String(k).padStart(5)).join('')}   tot`);
for (const km of ks) {
  const riga = ks.map((kv) => righe.filter((r) => r.k_motore === km && r.k_vero === kv).length);
  stampa(`     ${km}  ${riga.map((n) => String(n).padStart(5)).join('')}   ${riga.reduce((a, b) => a + b, 0)}`);
}
const giusti = righe.filter((r) => r.k_motore === r.k_vero).length;
const sotto = righe.filter((r) => r.k_motore < r.k_vero).length;
const sopra = righe.filter((r) => r.k_motore > r.k_vero).length;
stampa(`     il motore azzecca il numero di soste in ${giusti}/${righe.length} = ${(100 * giusti / righe.length).toFixed(1)}%`
  + `  ·  ne fa TROPPO POCHE in ${sotto}, troppe in ${sopra}`);
stampa(`     «arrivi cosi'»: A ${(100 * righe.filter((r) => r.arrivi_a).length / righe.length).toFixed(1)}%`
  + `  ·  B ${(100 * conB.filter((r) => r.arrivi_b).length / conB.length).toFixed(1)}%`);

// ── la lettura obbligata (prereg §5) ───────────────────────────────────────
const sBA = testSegni(conB.map((r) => ({ gara: r.gara, a: r.e_b, b: r.e_a })));
const sBC = testSegni(conB.map((r) => ({ gara: r.gara, a: r.e_b, b: r.e_c })));
stampa('');
stampa(`   segni  B contro A: ${sBA.vinceA}-${sBA.vinceB} (p = ${sBA.p.toFixed(4)})`
  + `   ·   B contro C: ${sBC.vinceA}-${sBC.vinceB} (p = ${sBC.p.toFixed(4)})`);

let ramo; let lettura;
if (medB > medCsuB) {
  ramo = 'NESSUNA DELLE DUE';
  lettura = 'Anche col numero di soste REGALATO il motore resta peggio della tabella di tre numeri. '
    + 'Il difetto non e\' in nessuna delle due scelte del piano: il motore non sa prevedere le decisioni '
    + 'dei team, e conoscere quante volte si fermano non lo aiuta. E\' il terzo esito scritto nella prereg §5, '
    + 'ed e\' quello che chiude la domanda invece di spostarla.';
} else if (DELTA >= DELTA_K) {
  ramo = 'LA SCELTA DI QUANTE SOSTE';
  lettura = `Regalare il numero di soste vero vale ${DELTA.toFixed(2)} giri di errore mediano. Il difetto sta `
    + 'nel confronto fra 0/1/2/3 soste — forma chiusa e pit-loss — non nella fisica del passo. Il lavoro va li\'.';
} else if (DELTA <= DELTA_GIRO) {
  ramo = 'IL GIRO DATO k';
  lettura = `Regalare il numero di soste vero vale ${DELTA.toFixed(2)} giri: quasi niente. Il motore sa quante `
    + 'volte fermarsi e sbaglia comunque QUANDO. Il difetto e\' la fisica del passo, e il lavoro va li\'.';
} else {
  ramo = 'CONDIVISO';
  lettura = `Delta = ${DELTA.toFixed(2)} giri sta fra le due soglie: la colpa e' divisa. Si riporta la `
    + 'ripartizione e si sceglie il ramo piu\' grande DICHIARANDO che e\' parziale.';
}

stampa('');
stampa(`   RAMO INDICATO: ${ramo}`);
for (const r of lettura.match(/.{1,84}(\s|$)/g)) stampa(`   ${r.trim()}`);
stampa('');
stampa('   Nessuna conseguenza automatica: qualunque sia l\'esito, il ramo indicato vuole la SUA prereg.');

const doc = {
  _targhetta: {
    cosa_e: 'Scomposizione dell errore del pianificatore sulla durata dello stint: quanto viene dalla scelta di k e quanto dal giro dato k.',
    prereg: 'ai_lab/pianificatore/PREREG_scomposizione_errore.md',
    generato_da: 'ai_lab/pianificatore/scomposizione_errore.mjs',
    data: '2026-08-05',
    natura: 'DIAGNOSI — non accende e non spedisce niente',
    braccio_B: 'riceve dal futuro il NUMERO di soste e nient altro. Non e un candidato alla produzione: nessun prodotto lo conosce in anticipo.',
    soglie_lettura: { delta_k: DELTA_K, delta_giro: DELTA_GIRO },
  },
  n: righe.length, n_con_B: conB.length, senza_k_vero: senzaKvero, non_misurabili: persi,
  errore_mediano: { A_intero: medA, C_intero: medC, A_su_B: medAsuB, B: medB, C_su_B: medCsuB },
  delta: DELTA,
  segni: { B_contro_A: sBA, B_contro_C: sBC },
  k: { azzeccati: giusti, troppo_poche: sotto, troppe: sopra, matrice: ks.map((km) => ({ k_motore: km, per_k_vero: Object.fromEntries(ks.map((kv) => [kv, righe.filter((r) => r.k_motore === km && r.k_vero === kv).length])) })) },
  ramo,
  lettura,
};
writeFileSync(path.join(RADICE, 'ai_lab/pianificatore/ESITO_scomposizione_errore.json'), JSON.stringify(doc, null, 1) + '\n');
if (JSON_OUT) console.log(JSON.stringify(doc, null, 1));
else stampa('\n   → ai_lab/pianificatore/ESITO_scomposizione_errore.json');
