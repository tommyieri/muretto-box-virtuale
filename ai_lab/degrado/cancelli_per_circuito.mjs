#!/usr/bin/env node
// cancelli_per_circuito.mjs — i quattro cancelli di PREREG_vita_per_circuito.md.
//
//     node ai_lab/degrado/cancelli_per_circuito.mjs [--json] [--senza-pianificatore]
//
// NON DECIDE: esegue cio' che la prereg ha gia' deciso. Perimetro, stimatore, nulli e
// soglie sono copiati da li' e non si toccano.
//
// I TRE BRACCI DIFFERISCONO PER UNA SOLA COSA: `fattore_circuito`. `giri[mescola]` e'
// identico in tutti e tre e si calcola sempre leave-one-race-out sul 2026.
//
//   STORICO  il fattore dal fondo 2018-2025 (forma storica, livello 2026)
//   N1       il fattore di oggi, ricalcolato leave-one-race-out dal 2026
//   N2       fattore = 1 per tutti: la pista non conta
//
// PERCHE' IL CANCELLO PRIMARIO NON PASSA DAL PIANIFICATORE (prereg §5). Qui la circolarita'
// non c'e': il fattore storico si stima su 2018-2025 e si giudica sul 2026, insiemi
// disgiunti per costruzione. Passare dal pianificatore avrebbe un costo misurato — sbaglia
// la durata di uno stint di 11 giri in mediana e dice «arrivi cosi'» in 99 casi su 167 — e
// misurerebbe soprattutto quel difetto, che e' il lavoro n. 3 del PO ed e' aperto. Il
// braccio col pianificatore si esegue lo stesso, come cancello di NON FARE DANNO (C4).
//
// COSA LO FA USCIRE 1:
//   (a) il perimetro non e' quello dichiarato (nessuno stint 2026 dentro);
//   (b) la ricetta 2026 non riproduce piu' i fattori in produzione — allora N1 non e' il
//       fattore di oggi e il confronto non e' quello scritto nella prereg.

import { writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { RADICE, gare, garaSimDi, contestoNuovo } from '../confronto/banco.mjs';
import { testSegni } from '../confronto/bandiera.mjs';
import { decisioni, vitaDa, vitaCieca, MESCOLE } from './decisioni.mjs';
import { durateFondo, nelPerimetro, mediana, PISTE_2026, PISTA_ZANDVOORT } from './durate.mjs';
import { fattore2026, fattoreStorico } from './fattore_circuito.mjs';
import { pianoOttimo } from '../../simulatore/scenario/piano.mjs';
import { contaDistinti, abGiudicabile } from '../lib/bracci.mjs';

const ARGV = process.argv.slice(2);
const JSON_OUT = ARGV.includes('--json');
const SENZA_PIANO = ARGV.includes('--senza-pianificatore');

// Soglie da PREREG_vita_per_circuito.md §7. NON si toccano qui.
const SOGLIA_C1_GIRI = 0.5;
const SOGLIA_P = 0.05;
const PLACEBO_RIPETIZIONI = 200;
const PLACEBO_SEME = 20260804;
const SOGLIA_C4_GIRI = 0.5;

const stampa = (s = '') => { if (!JSON_OUT) console.log(s); };

// ── il perimetro (prereg §3) ────────────────────────────────────────────────
const TUTTE = decisioni();
const D = TUTTE.filter((d) => nelPerimetro(d) === null);
if (!D.length) { console.error('perimetro vuoto: non giudico.'); process.exit(1); }

const pesi = {};
for (const d of D) pesi[d.gara] = (pesi[d.gara] ?? 0) + 1;

// ── i fattori (prereg §4) ───────────────────────────────────────────────────
const { righe: FONDO } = durateFondo(RADICE);
const STORICO = fattoreStorico(FONDO, pesi);

// (b) N1 dev'essere il fattore di OGGI: se la ricetta non riproduce la produzione, il
// confronto non e' quello scritto nella prereg e non si giudica.
const inProduzione = JSON.parse(readFileSync(path.join(RADICE, 'simulatore', 'data', 'modelli', 'vita_mescola.json'), 'utf8')).fattore_circuito;
if (inProduzione == null) {
  // Fino al 07/08 questo caso moriva con un TypeError alla Object.entries — cioe' il
  // cancello si era spento da solo SENZA DIRLO quando il fattore e' uscito dalla
  // produzione (spegnimento del 04/08). Un processo che muore non ha detto niente:
  // il rifiuto va dichiarato (lo stesso guasto di cancelli_vita, E22).
  console.error('N1 NON ESISTE PIU\': vita_mescola.json non porta fattore_circuito — il fattore per');
  console.error('circuito e\' SPENTO in produzione (decisione 04/08). Questo cancello confronta il');
  console.error('fattore storico contro quello DI OGGI: senza un N1 in produzione il confronto della');
  console.error('prereg non esiste, e il cancello appartiene a un capitolo chiuso. Non giudico.');
  process.exit(1);
}
{
  const ricetta = fattore2026(TUTTE).fattore;
  for (const [c, v] of Object.entries(inProduzione)) {
    if (ricetta[c] === undefined || Math.abs(Number(ricetta[c].toFixed(3)) - v) > 1e-9) {
      console.error(`N1 NON E' IL FATTORE DI OGGI: ${c} produzione=${v} ricetta=${ricetta[c]}`);
      process.exit(1);
    }
  }
}

// ── il cancello primario: descrittivo, tre bracci, un solo ingrediente diverso ──
function errori(fattoreDi) {
  const out = [];
  for (const gara of new Set(D.map((d) => d.gara))) {
    const vitaLoo = vitaDa(D, gara);
    const ciecaLoo = vitaCieca(D, gara);
    for (const d of D.filter((x) => x.gara === gara)) {
      const giri = vitaLoo[d.mescola] ?? ciecaLoo;
      const prevista = giri * fattoreDi(d.gara, gara);
      out.push({ gara: d.gara, mescola: d.mescola, durata: d.durata, prevista, e: Math.abs(prevista - d.durata) });
    }
  }
  return out;
}

const F_STORICO = (c) => STORICO.fattore[c] ?? 1;
const F_N2 = () => 1;

// ── N1, E IL CANCELLO CHE LA PREREG HA CHIESTO IMPOSSIBILE ──────────────────
//
// La prereg §5 scrive: «Il fattore 2026 (il nullo N1) si ricalcola anch'esso
// leave-one-race-out». NON ESISTE, e la ragione e' strutturale, non un difetto di codice:
// nel 2026 ogni circuito compare ESATTAMENTE UNA VOLTA, quindi togliere la gara toglie il
// circuito, e il fattore leave-one-race-out di Monaco e' `undefined` — cioe' 1, cioe' N2.
// La prima scrittura di questo file lo faceva davvero, e N1 e N2 uscivano identici in ogni
// riga: due nulli che sembravano due e ne erano uno.
//
// Messo a referto in ESITO_vita_per_circuito.md invece che aggiustato in silenzio (regola
// 3). La conseguenza che conta e' piu' grande del cancello: IL FATTORE IN PRODUZIONE NON
// PUO' ESSERE VALIDATO FUORI CAMPIONE, con nessuna procedura, finche' il 2026 e' l'unica
// fonte — undici circuiti, una gara ciascuno. Quello storico si', perche' fondo e 2026 sono
// disgiunti per costruzione.
//
// Qui N1 resta il fattore di oggi COM'E', cioe' IN CAMPIONE: ha gia' visto le durate che
// deve prevedere. E' un nullo FAVORITO, e batterlo sarebbe stato un risultato forte; non
// batterlo non dice quasi niente. L'etichetta viaggia con il numero.
const F_N1 = (c) => inProduzione[c] ?? 1;

const eStorico = errori((c) => F_STORICO(c));
const eN1 = errori((c) => F_N1(c));
const eN2 = errori(F_N2);

const med = (v) => mediana(v.map((r) => r.e));
const coppie = (a, b) => a.map((r, i) => ({ gara: r.gara, a: r.e, b: b[i].e }));
const c1 = testSegni(coppie(eStorico, eN2));
const c2 = testSegni(coppie(eStorico, eN1));

const guadagnoSuN2 = med(eN2) - med(eStorico);
const C1 = guadagnoSuN2 >= SOGLIA_C1_GIRI && c1.vinceA > c1.vinceB && c1.p <= SOGLIA_P;
const C2 = med(eStorico) <= med(eN1);

// ── C3 · il placebo: i fattori veri, assegnati alle piste sbagliate ─────────
// Se rimescolarli funziona quasi come assegnarli giusti, il guadagno viene dall'ESISTERE di
// una dispersione, non dalla pista. E' il cancello che conta di piu' — la volta scorsa fu
// esattamente questo a dire che il guadagno veniva dal pavimento uniforme.
const PISTE_VALUTATE = [...new Set(D.map((d) => d.gara))];
const valori = PISTE_VALUTATE.map((c) => F_STORICO(c));
let seme = PLACEBO_SEME;
const rnd = () => { seme = (seme * 1103515245 + 12345) & 0x7fffffff; return seme / 0x7fffffff; };
const guadagniFinti = [];
for (let k = 0; k < PLACEBO_RIPETIZIONI; k += 1) {
  const mesc = [...valori];
  for (let i = mesc.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [mesc[i], mesc[j]] = [mesc[j], mesc[i]]; }
  const mappa = Object.fromEntries(PISTE_VALUTATE.map((c, i) => [c, mesc[i]]));
  guadagniFinti.push(med(eN2) - med(errori((c) => mappa[c] ?? 1)));
}
const battuti = guadagniFinti.filter((g) => g >= guadagnoSuN2).length;
const pPlacebo = (battuti + 1) / (PLACEBO_RIPETIZIONI + 1);
const C3 = pPlacebo <= SOGLIA_P;

stampa('');
stampa('══ CANCELLI DELLA VITA PER CIRCUITO — PREREG_vita_per_circuito.md ══════════');
stampa(`   perimetro 2026: ${D.length} stint su ${TUTTE.length} (via ${TUTTE.length - D.length}: sosta sotto SC o rossa, o dato assente)`);
stampa(`   fondo: ${STORICO.n} stint nel perimetro · ${Object.keys(STORICO.grezzo).length} piste con fattore proprio`);
stampa('');
stampa('   circuito         n     2026   storico   |   err. STORICO   err. N1   err. N2');
for (const c of PISTE_VALUTATE.sort()) {
  const sel = (v) => v.filter((r) => r.gara === c);
  stampa(`   ${c.padEnd(14)} ${String(pesi[c]).padStart(3)}   ${inProduzione[c].toFixed(3)}    ${F_STORICO(c).toFixed(3)}   |`
    + `   ${String(mediana(sel(eStorico).map((r) => r.e)).toFixed(1)).padStart(11)}`
    + `   ${String(mediana(sel(eN1).map((r) => r.e)).toFixed(1)).padStart(7)}`
    + `   ${String(mediana(sel(eN2).map((r) => r.e)).toFixed(1)).padStart(7)}`);
}
stampa('');
stampa(`   errore mediano in giri:  STORICO ${med(eStorico).toFixed(2)}  ·  N1 fattore di oggi ${med(eN1).toFixed(2)}  ·  N2 nessun fattore ${med(eN2).toFixed(2)}`);
stampa('');
stampa(`   C1  batte N2 (nessun fattore) di >= ${SOGLIA_C1_GIRI} giri e p <= ${SOGLIA_P}:`);
stampa(`         guadagno ${guadagnoSuN2.toFixed(2)} giri · segni ${c1.vinceA}-${c1.vinceB} (pari ${c1.pari}, p=${c1.p.toFixed(4)})   ${C1 ? 'PASSA' : 'NON PASSA'}`);
stampa(`   C2  non peggio di N1 (il fattore di oggi):`);
stampa(`         ${med(eStorico).toFixed(2)} contro ${med(eN1).toFixed(2)} · segni ${c2.vinceA}-${c2.vinceB} (p=${c2.p.toFixed(4)})   ${C2 ? 'PASSA' : 'NON PASSA'}`);
stampa(`   C3  placebo su ${PLACEBO_RIPETIZIONI} rimescolamenti (seme ${PLACEBO_SEME}):`);
stampa(`         guadagni finti >= quello vero: ${battuti}/${PLACEBO_RIPETIZIONI} · p=${pPlacebo.toFixed(4)}   ${C3 ? 'PASSA' : 'NON PASSA'}`);

// ── C4 · non fare danno, attraverso il pianificatore ────────────────────────
function durataPrevista(d, contesto) {
  const g = contesto.gare[garaSimDi(d.gara)];
  if (!g) return null;
  try {
    const p = pianoOttimo({ gara: garaSimDi(d.gara), freezeLap: d.giro_inizio, pilota: d.drv, giroFinale: g.nGiri },
      { ...contesto, nGiriGara: g.nGiri });
    if (!p?.migliore) return null;
    const soste = p.migliore.piano.soste;
    return soste.length ? soste[0].giro - d.giro_inizio : g.nGiri - d.giro_inizio;
  } catch { return null; }
}

let C4 = null; let c4Giudicabile = null; const pianoRis = {};
if (!SENZA_PIANO) {
  const bracci = { STORICO: (c) => F_STORICO(c), N1: null, N2: F_N2 };
  const perBraccio = { STORICO: [], N1: [], N2: [] };
  const coppie = { storicoVsN2: [], n1VsN2: [], storicoVsN1: [] };
  const mossi = {};
  let persi = 0;
  for (const gara of gare()) {
    const mie = D.filter((d) => d.gara === gara);
    if (!mie.length) continue;
    const vitaLoo = vitaDa(D, gara);
    const base = contestoNuovo(gara);
    const ctx = (fatt) => ({ ...base, vitaMescola: { attivo: true, giri: vitaLoo, fattore_circuito: fatt } });
    const contesti = {
      STORICO: ctx(Object.fromEntries(PISTE_VALUTATE.map((c) => [c, F_STORICO(c)]))),
      N1: ctx(inProduzione),
      N2: ctx(Object.fromEntries(PISTE_VALUTATE.map((c) => [c, 1]))),
    };
    for (const d of mie) {
      const v = {};
      let completo = true;
      for (const b of Object.keys(bracci)) {
        const p = durataPrevista(d, contesti[b]);
        if (p === null) { completo = false; break; }
        v[b] = Math.abs(p - d.durata);
      }
      if (!completo) { persi += 1; continue; }
      for (const b of Object.keys(bracci)) perBraccio[b].push(v[b]);
      // QUANTE VOLTE I BRACCI SI DISTINGUONO DAVVERO. Un cancello di non-fare-danno che
      // passa perche' non si muove niente non e' un cancello: e' un termometro rotto che
      // segna sempre la stessa temperatura. Il 04/08 questo progetto ha trovato proprio
      // cosi' un guasto in cancelli_vita.mjs (E22). Dal 07/08 il conto non e' piu' solo
      // stampato: VINCOLA — la coppia giudicata da C4 e' STORICO vs N1, e se non si
      // distingue mai il cancello e' NON GIUDICABILE, non PASSA (lib/bracci.mjs).
      coppie.storicoVsN2.push([v.STORICO, v.N2]);
      coppie.n1VsN2.push([v.N1, v.N2]);
      coppie.storicoVsN1.push([v.STORICO, v.N1]);
    }
  }
  for (const k of Object.keys(coppie)) mossi[k] = contaDistinti(coppie[k]);
  for (const b of Object.keys(perBraccio)) pianoRis[b] = perBraccio[b].length ? mediana(perBraccio[b]) : null;
  pianoRis.n = perBraccio.STORICO.length;
  pianoRis.non_misurabili = persi;
  pianoRis.decisioni_in_cui_i_bracci_differiscono = { ...mossi };
  c4Giudicabile = abGiudicabile(coppie.storicoVsN1);
  C4 = c4Giudicabile && (pianoRis.STORICO - pianoRis.N1) <= SOGLIA_C4_GIRI;
  stampa(`   C4  non fare danno attraverso il pianificatore (peggiora al piu' di ${SOGLIA_C4_GIRI} giri):`);
  stampa(`         errore mediano  STORICO ${pianoRis.STORICO}  ·  N1 ${pianoRis.N1}  ·  N2 ${pianoRis.N2}`
    + `  su ${pianoRis.n} decisioni (${persi} non misurabili)   ${c4Giudicabile ? (C4 ? 'PASSA' : 'NON PASSA') : 'NON GIUDICABILE (bracci A/A)'}`);
  stampa(`         i bracci si distinguono su: STORICO≠N1 ${mossi.storicoVsN1}/${pianoRis.n}`
    + ` · STORICO≠N2 ${mossi.storicoVsN2}/${pianoRis.n}`
    + ` · N1≠N2 ${mossi.n1VsN2}/${pianoRis.n}`);
}

// ── le robustezze: si misurano, si riportano, NON decidono (prereg §9) ──────
const robustezze = {};
{
  const su = (etichetta, fatt, insieme) => {
    const e = insieme.map((r) => r.e);
    robustezze[etichetta] = { errore_mediano: mediana(e), n: insieme.length, fattore: fatt };
  };
  const era1 = fattoreStorico(FONDO, pesi, { anni: [2018, 2019, 2020, 2021] });
  const era2 = fattoreStorico(FONDO, pesi, { anni: [2022, 2023, 2024, 2025] });
  su('ere_2018_2021', era1.fattore, errori((c) => era1.fattore[c] ?? 1));
  su('ere_2022_2025', era2.fattore, errori((c) => era2.fattore[c] ?? 1));
  const largo = fattoreStorico(FONDO, pesi, { finestra: 2 });
  su('esclusione_larga', largo.fattore, errori((c) => largo.fattore[c] ?? 1));
  robustezze.stabilita_per_anno = Object.fromEntries(
    [...PISTE_2026, PISTA_ZANDVOORT].map((c) => [c, STORICO.perPista[c]?.r_per_anno ?? null]),
  );
  // §9.4 · gli stessi tre bracci sul perimetro INTERO (senza l'esclusione §3.1)
  const errInteri = (fattoreDi) => {
    const out = [];
    for (const gara of new Set(TUTTE.map((d) => d.gara))) {
      const vitaLoo = vitaDa(TUTTE, gara); const ciecaLoo = vitaCieca(TUTTE, gara);
      for (const d of TUTTE.filter((x) => x.gara === gara)) {
        const giri = vitaLoo[d.mescola] ?? ciecaLoo;
        out.push({ e: Math.abs(giri * fattoreDi(d.gara, gara) - d.durata) });
      }
    }
    return mediana(out.map((r) => r.e));
  };
  robustezze.perimetro_intero = {
    n: TUTTE.length,
    STORICO: errInteri((c) => F_STORICO(c)),
    N1: errInteri((c) => F_N1(c)),
    N2: errInteri(F_N2),
  };
}

stampa('');
stampa('   robustezze (dichiarate prima, NON decidono):');
stampa(`     errore mediano · era 13" (2018-21) ${robustezze.ere_2018_2021.errore_mediano.toFixed(2)}`
  + ` · era 18" (2022-25) ${robustezze.ere_2022_2025.errore_mediano.toFixed(2)}`
  + ` · esclusione larga ${robustezze.esclusione_larga.errore_mediano.toFixed(2)}`);
stampa(`     perimetro intero (${robustezze.perimetro_intero.n} stint): STORICO ${robustezze.perimetro_intero.STORICO.toFixed(2)}`
  + ` · N1 ${robustezze.perimetro_intero.N1.toFixed(2)} · N2 ${robustezze.perimetro_intero.N2.toFixed(2)}`);

// ── la lettura obbligata (prereg §8) ────────────────────────────────────────
let verdetto;
if (!C1) verdetto = 'NULL — C1 fallisce: il fattore storico non batte «la pista non conta». La stessa evidenza toglie la gamba anche al fattore 2026: la PROPOSTA al PO e\' spegnere il fattore per circuito, non sostituirlo.';
else if (!C3) verdetto = 'NULL — C3 fallisce: rimescolare i fattori fra i circuiti funziona quanto assegnarli giusti. Il guadagno non e\' la pista.';
else if (!C2) verdetto = 'RIPORTATO, NON PROMOSSO — C1 e C3 passano ma C2 no: il fattore storico e\' meglio di niente e peggio del rattoppo.';
else if (c4Giudicabile === false) verdetto = 'NON PROMOSSO — C4 NON GIUDICABILE: i bracci STORICO e N1 non si distinguono mai su queste decisioni, quindi il cancello di non-fare-danno non ha misurato niente (il caso cancelli_vita, E22). Un pass vuoto non e\' un pass.';
else if (C4 === false) verdetto = 'NON PROMOSSO — C1, C2, C3 passano ma C4 no: il parametro migliore attraverso un obiettivo rotto peggiora il prodotto. Prima il lavoro n. 3.';
else verdetto = 'PROMOSSO alla decisione del PO — i cancelli passano. Zandvoort riceve il suo fattore dalle edizioni 2021-2025 invece del fattore 1 di default.';

stampa('');
stampa('   LETTURA OBBLIGATA DALLA PREREG §8:');
for (const r of verdetto.match(/.{1,84}(\s|$)/g)) stampa(`   ${r.trim()}`);

const doc = {
  _targhetta: {
    cosa_e: 'Esito dei cancelli C1-C4 di PREREG_vita_per_circuito.md — il fattore per circuito dal fondo 2018-2025 contro due nulli.',
    prereg: 'ai_lab/degrado/PREREG_vita_per_circuito.md',
    generato_da: 'ai_lab/degrado/cancelli_per_circuito.mjs',
    data: '2026-08-04',
    soglie: { c1_giri: SOGLIA_C1_GIRI, p: SOGLIA_P, placebo_ripetizioni: PLACEBO_RIPETIZIONI, placebo_seme: PLACEBO_SEME, c4_giri: SOGLIA_C4_GIRI },
  },
  perimetro: { stint_2026: D.length, stint_2026_totali: TUTTE.length, stint_fondo: STORICO.n },
  fattori: { produzione_2026: inProduzione, storico: STORICO.fattore, grezzo: STORICO.grezzo, K: STORICO.K },
  errore_mediano: { STORICO: med(eStorico), N1: med(eN1), N2: med(eN2) },
  cancelli: {
    C1: { passa: C1, guadagno_giri: guadagnoSuN2, segni: c1 },
    C2: { passa: C2, storico: med(eStorico), n1: med(eN1), segni: c2 },
    C3: { passa: C3, p: pPlacebo, battuti, ripetizioni: PLACEBO_RIPETIZIONI },
    C4: C4 === null ? null : { passa: C4, giudicabile: c4Giudicabile, ...pianoRis },
  },
  robustezze,
  verdetto,
};
writeFileSync(path.join(RADICE, 'ai_lab/degrado/ESITO_cancelli_per_circuito.json'), JSON.stringify(doc, null, 1) + '\n');
if (JSON_OUT) console.log(JSON.stringify(doc, null, 1));
else stampa('\n   → ai_lab/degrado/ESITO_cancelli_per_circuito.json');
