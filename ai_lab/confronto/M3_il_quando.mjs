#!/usr/bin/env node
// M3_il_quando.mjs — LA METRICA M3: «il prodotto sa dire QUANDO conviene fermarsi?».
//
//     node ai_lab/confronto/M3_il_quando.mjs            tutto
//     node ai_lab/confronto/M3_il_quando.mjs --json     lo stesso, in JSON
//     node ai_lab/confronto/M3_il_quando.mjs --breve    salta la sensibilita' H=L+15
//
// Non scrive niente su disco, non tocca demo/ simulatore/ data/.
//
// ============================================================================
// LE SCELTE, DICHIARATE PRIMA DI GUARDARE I NUMERI
// ============================================================================
// La PREREG scrive: «M3 — il "quando": quota di casi in cui il minimo della curva cade
// all'INTERNO e non al primo giro utile. Il vecchio e' noto a 0/249; il nuovo deve stare
// >= 50% sugli stessi casi». Quattro cose vanno decise prima, perche' il numero cambia:
//
// S1 · GIRO FINALE COMUNE. Una curva del «quando» confronta STRATEGIE, quindi tutti i
//      candidati devono finire allo STESSO giro. Il nuovo lo fa per costruzione
//      (`curvaDelQuando` usa `giroFinale = nGiriGara`). Il vecchio no: `evaluatePit` usa
//      `steps = (pitLap - L) + 1 + orizzonte`, quindi a orizzonte fisso ogni candidato e'
//      valutato a un giro DIVERSO e i totali non sono sottraibili. Qui il vecchio riceve
//      `orizzonte = H - pitLap - 1`, che fissa il giro finale a H per ogni candidato.
//      H = nGiri (la bandiera), lo stesso del nuovo. In coda c'e' anche H = min(nGiri, L+15)
//      come sensibilita', perche' e' l'orizzonte su cui il collaudo aveva misurato.
//
// S2 · CANDIDATI IDENTICI. giroPit da L+1 a H-1 compresi, per entrambi: e' l'intervallo di
//      `curvaDelQuando`. Il vecchio non ne ha uno suo, quindi si copia quello del nuovo.
//
// S3 · IL VECCHIO E' DUE MOTORI, E VANNO MISURATI ENTRAMBI. `gen_hero.mjs` (e quindi il
//      banco) chiama `evaluatePit` senza `passo`. Ma il pannello di produzione
//      `demo/muretto.mjs` ha `PASSO_V2_ATTIVO = true` dal 28/07 e passa
//      `passo = {delta, rho}` da `demo/data/modello_passo_2026.json`, che spegne gradino e
//      deriva e fa AZZERARE l'eta gomma alla sosta. Sono due fisiche diverse proprio sulla
//      domanda di M3: col gradino costante anticipare e' sempre meglio (lo dice il commento
//      in testa a `demo/pitscenario.mjs`), con l'azzeramento dell'eta il minimo puo' cadere
//      in mezzo. Misurare solo il primo e dichiarare «il vecchio non sa rispondere» sarebbe
//      giudicare un fantoccio. Si misurano tutte e due, con l'etichetta.
//
// S4 · LA MESCOLA DEL NUOVO, che decide se la curva esiste. `curvaDelQuando` vuole una
//      mescola per la sosta, e il Director la valida col regolamento 2026 (due slick
//      sull'asciutto, REG01). Due convenzioni legittime:
//        A · quella AL CONGELAMENTO — e' cio' che fa il SITO (`scenario/risposta.mjs`
//            passa `mescolaAlGiro`) e cio' che fa `rispostaNuovo` nel banco. Se il pilota
//            ha usato una sola slick, rimontare la stessa lo lascia a una sola mescola alla
//            bandiera: REG01 FATAL, e la curva non esce.
//        B · quella che SODDISFA IL REGOLAMENTO, scelta con la regola gia' scritta nel repo
//            (`scenario/piano.mjs::mescolePerSoste(1, mescole_slick_usate <= L)`), la stessa
//            che usa `pianoOttimo`. Non e' una mescola inventata da questo script.
//      Nel modello v2 la mescola NON cambia il degrado (MESCOLA_NON_SEPARA, p = 0,209):
//      fra A e B i TEMPI sono identici. Cambia solo se il Director lascia uscire il numero.
//      Percio' la differenza fra A e B non e' fisica, e' copertura — e va letta cosi'.
//
// S5 · LA CURVA PIATTA NON E' UN MINIMO INTERNO. `ampiezza = max(totale) - min(totale)`;
//      se `ampiezza <= 0,01 s` la curva e' PIATTA e si conta a parte. Serve perche' il
//      minimo di una curva piatta e' rumore di virgola mobile: la somma dei tempi e' la
//      stessa quantita' sommata in ordine diverso, e l'argmin cade dove capita. Senza
//      questo filtro si attribuisce al motore una capacita' che ha solo l'aritmetica IEEE.
//
// COSA NON MISURA. M3 guarda DOVE cade il minimo, non se quel minimo e' GIUSTO: non
// esiste una verita' per «il giro migliore in cui fermarsi» (nella gara vera i rivali
// reagiscono, e il pilota si e' fermato una volta sola). Una quota alta di minimi interni
// dice che la domanda del prodotto ha una risposta, non che la risposta sia esatta.

import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import {
  casi, ingressiVecchio, contestoNuovo, garaNuova, gare, RADICE,
} from './banco.mjs';
import { evaluatePit } from '../../demo/pitscenario.mjs';
import { curvaDelQuando } from '../../simulatore/scenario/costruttore.mjs';
import { mescolePerSoste } from '../../simulatore/scenario/piano.mjs';
import { MESCOLE_SLICK_ATTUALI } from '../../simulatore/provenienza/vocabolario.mjs';

const JSONOUT = process.argv.includes('--json');
const BREVE = process.argv.includes('--breve');
const PIATTA_S = 0.01;   // S5

// —————————————————————————————————————————————————————————————— utilita'
const mediana = (v) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (a, b) => (b ? `${(100 * a / b).toFixed(1)}%` : 'n/d');
const f = (x, n = 3) => (x == null ? 'n/d' : x.toFixed(n));

// —————————————————————————————————————————————————— la curva del VECCHIO
// Gli argomenti si costruiscono UNA volta per caso (byLap troncato, pace, present, gradino
// da demo/gradino.mjs::misura) e poi si variano SOLO `pitLap` e `orizzonte`: e' esattamente
// cio' che farebbe `ingressiVecchio` a ogni chiamata, ma senza rimisurare il gradino 60
// volte. Verificato piu' sotto (controllo C1) che le due strade danno lo stesso numero.
const baseVecchio = new Map();
function argomentiBase(caso, troncato = true) {
  const k = `${caso.id}|${troncato}`;
  if (!baseVecchio.has(k)) baseVecchio.set(k, ingressiVecchio(caso, { troncato }).argomenti);
  return baseVecchio.get(k);
}

/**
 * @returns `{ punti: [[giroPit, totale]], motivo }` — `punti` null se la curva non esiste.
 */
function curvaVecchio(caso, passo, H, troncato = true) {
  const L = caso.freezeLap;
  const base = argomentiBase(caso, troncato);
  const punti = [];
  for (let p = L + 1; p <= H - 1; p += 1) {
    let r;
    try {
      r = evaluatePit({ ...base, pitLap: p, orizzonte: H - p - 1, passo,
                        // col passo v2 il pannello spegne gradino e deriva (E20): tenerli
                        // conterebbe due volte. `simulaPasso` lo fa gia' internamente,
                        // qui e' esplicito perche' si veda.
                        gradino: passo ? null : base.gradino, deriva: null });
    } catch (e) { return { punti: null, motivo: `eccezione: ${e.message}` }; }
    if (!r?.ok) return { punti: null, motivo: r?.reason ?? 'nessuna risposta' };
    const mio = r.ordine_previsto.find(([d]) => d === caso.pilota);
    if (!mio) return { punti: null, motivo: 'il pilota non compare nell\'ordine previsto' };
    punti.push([p, mio[1]]);
  }
  if (punti.length < 3) return { punti: null, motivo: `meno di 3 candidati (${punti.length})` };
  return { punti, motivo: null };
}

// ———————————————————————————————————————————————————— la curva del NUOVO
/** Le slick gia' usate dal pilota fino al congelamento COMPRESO (informazione <= L). */
function slickUsate(caso) {
  const g = garaNuova(caso.gara);
  const usate = new Set();
  for (const [lap, c] of g.perPilota.get(caso.pilota)) {
    if (lap <= caso.freezeLap && c.compound !== null && MESCOLE_SLICK_ATTUALI.has(c.compound)) usate.add(c.compound);
  }
  return usate;
}
/** S4-B: la mescola che soddisfa il regolamento, con la regola gia' scritta nel repo. */
function mescolaLegale(caso) {
  return mescolePerSoste(1, slickUsate(caso))[0] ?? null;
}

function curvaNuovo(caso, mescola, H) {
  if (mescola === null) return { punti: null, motivo: 'nessuna mescola slick al congelamento', respinti: null, candidati: null };
  const contesto = contestoNuovo(caso.gara);   // COPIA con nGiriGara: non si muta il condiviso
  let r;
  try {
    r = curvaDelQuando({ gara: caso.garaSim, freezeLap: caso.freezeLap, pilota: caso.pilota, mescola },
                       { ...contesto, giroFinale: H });
  } catch (e) { return { punti: null, motivo: `eccezione: ${e.message}`, respinti: null, candidati: null }; }
  const candidati = Math.max(0, H - 1 - caso.freezeLap);
  if (!r || r.approvato !== true) {
    const viol = (r?.direttore?.violazioni ?? []).filter((v) => v.severita === 'FATAL');
    const motivi = [...new Set(viol.map((v) => v.codice ?? v.messaggio))];
    // Due silenzi DIVERSI, e confonderli sarebbe l'errore piu' comodo: `curvaDelQuando`
    // esce con `approvato: false` sia quando il Director respinge OGNI candidato, sia
    // quando nessun candidato ha un totale (il pilota non ha un passo base: regola 6, non
    // un rifiuto). Si distinguono guardando `respinti` e `direttore.approved`.
    const rifiuto = (r?.respinti ?? 0) > 0 || motivi.length > 0;
    return { punti: null,
             motivo: rifiuto
               ? `respinta dal Director: ${motivi.join(' · ') || 'senza codice dichiarato'}`
               : 'nessun totale: il pilota non ha un passo base al congelamento (regola 6, NON un rifiuto del Director)',
             respinti: r?.respinti ?? null, candidati };
  }
  if (!r.curva?.length) return { punti: null, motivo: 'curva vuota', respinti: r.respinti_dal_director, candidati };
  // `delta_s` e' gia' la distanza dal minimo: e' una traslazione del totale, e argmin,
  // ampiezza e forma non cambiano. Si usa quello, cosi' non si re-inventa il totale.
  const punti = r.curva.map((c) => [c.giroPit, c.delta_s]);
  if (punti.length < 3) return { punti: null, motivo: `meno di 3 candidati validi (${punti.length})`,
                                 respinti: r.respinti_dal_director, candidati };
  return { punti, motivo: null, respinti: r.respinti_dal_director, candidati };
}

// ———————————————————————————————————————————————— classificazione (S5)
function classifica(punti) {
  const v = punti.map((x) => x[1]);
  const min = Math.min(...v), max = Math.max(...v);
  const ampiezza = max - min;
  const iMin = v.reduce((m, x, i) => (x < v[m] ? i : m), 0);
  const piatta = ampiezza <= PIATTA_S;
  return {
    n: punti.length, ampiezza, iMin, piatta,
    giroMin: punti[iMin][0], primoGiro: punti[0][0], ultimoGiro: punti[punti.length - 1][0],
    dove: piatta ? 'piatta' : (iMin === 0 ? 'primo' : (iMin === punti.length - 1 ? 'ultimo' : 'interno')),
    // profondita': quanto il minimo interno batte il MIGLIORE dei due estremi. Un minimo
    // interno che vale 0,003 s non e' una raccomandazione, e' rumore sopra la soglia.
    profondita: Math.min(v[0], v[v.length - 1]) - min,
  };
}

// ———————————————————————————————————————————————————————— aggregazione
function vuota() { return { curve: 0, mute: 0, piatte: 0, interni: 0, primo: 0, ultimo: 0,
                            ampiezze: [], profondita: [], motivi: {}, perGara: {} }; }
function accumula(agg, caso, esito) {
  const gara = caso.gara;
  agg.perGara[gara] ??= { curve: 0, mute: 0, piatte: 0, interni: 0, primo: 0, ultimo: 0 };
  const g = agg.perGara[gara];
  if (!esito.punti) {
    agg.mute += 1; g.mute += 1;
    const k = String(esito.motivo).slice(0, 70);
    agg.motivi[k] = (agg.motivi[k] ?? 0) + 1;
    return null;
  }
  const c = classifica(esito.punti);
  agg.curve += 1; g.curve += 1;
  agg.ampiezze.push(c.ampiezza);
  if (c.dove === 'piatta') { agg.piatte += 1; g.piatte += 1; }
  else if (c.dove === 'interno') { agg.interni += 1; g.interni += 1; agg.profondita.push(c.profondita); }
  else if (c.dove === 'primo') { agg.primo += 1; g.primo += 1; }
  else { agg.ultimo += 1; g.ultimo += 1; }
  return c;
}

// ————————————————————————————— la controprova: la vista GIA' PRE-CALCOLATA
// `demo/data/vista/<gara>/<pilota>.json` e' cio' che il sito serve davvero: il motore
// nuovo, convenzione A (mescola al congelamento), su OGNI pilota e OGNI giro. Non e' una
// seconda misura del motore — e' la stessa — ma su una popolazione molto piu' ampia delle
// 274 soste, e serve a distinguere «il prodotto e' fatto cosi'» da «il campione e' fatto
// cosi'». Sola lettura.
function vista() {
  const base = path.join(RADICE, 'demo', 'data', 'vista');
  const out = { tot: 0, senzaRisposta: 0, rifiutati: 0, senzaCurva: 0, conCurva: 0,
                piatte: 0, interni: 0, primo: 0, ultimo: 0 };
  for (const g of readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
    for (const nome of readdirSync(path.join(base, g))) {
      if (!nome.endsWith('.json') || nome.includes('fantasma') || nome === 'indice.json') continue;
      const j = JSON.parse(readFileSync(path.join(base, g, nome), 'utf8'));
      for (const r of j.giri ?? []) {
        out.tot += 1;
        if (r.senza_risposta) { out.senzaRisposta += 1; continue; }
        if (r.approvato === false) { out.rifiutati += 1; continue; }
        if (!r.curva?.length) { out.senzaCurva += 1; continue; }
        out.conCurva += 1;
        const c = classifica(r.curva.map((x) => [x.giroPit, x.delta_s]));
        out[{ piatta: 'piatte', interno: 'interni', primo: 'primo', ultimo: 'ultimo' }[c.dove]] += 1;
      }
    }
  }
  return out;
}

// ============================================================================
// ESECUZIONE
// ============================================================================
const elenco = casi();
const modelloPasso = JSON.parse(readFileSync(path.join(RADICE, 'demo', 'data', 'modello_passo_2026.json'), 'utf8'));
const passoV2 = { delta: modelloPasso.deriva.delta_gara_s, rho: modelloPasso.degrado.rho_s_giro };

const MOTORI = [
  ['VECCHIO passo=null (banco/gen_hero)', (c, H) => curvaVecchio(c, null, H)],
  ['VECCHIO passo=v2 (pannello prod.)',   (c, H) => curvaVecchio(c, passoV2, H)],
  ['NUOVO mescola AL CONGELAMENTO (sito)', (c, H) => curvaNuovo(c, c.mescolaAlCongelamento, H)],
  ['NUOVO mescola LEGALE (regola repo)',   (c, H) => curvaNuovo(c, mescolaLegale(c), H)],
];

function giroFinale(caso) { return caso.nGiri; }

const agg = MOTORI.map(() => vuota());
const dettaglio = [];   // per caso: la classificazione dei quattro
for (const caso of elenco) {
  const H = giroFinale(caso);
  const riga = { id: caso.id, gara: caso.gara, L: caso.freezeLap, H, per: [] };
  for (let i = 0; i < MOTORI.length; i += 1) {
    const esito = MOTORI[i][1](caso, H);
    const c = accumula(agg[i], caso, esito);
    riga.per.push(c ? { dove: c.dove, n: c.n, ampiezza: c.ampiezza, giroMin: c.giroMin,
                        primoGiro: c.primoGiro, profondita: c.profondita,
                        // buchi: quanti candidati fra L+1 e H-1 il motore NON ha valutato,
                        // e se il primo punto della curva e' davvero il primo giro utile.
                        buchi: (H - 1 - caso.freezeLap) - c.n,
                        primoEDavveroIlPrimo: c.primoGiro === caso.freezeLap + 1,
                        ritardoMin: c.giroMin - caso.freezeLap }
                    : { dove: 'muta', motivo: esito.motivo });
  }
  dettaglio.push(riga);
}

// —————————————————————————————————————— C1: la scorciatoia degli argomenti regge?
// Il caso a meta' elenco, ricostruito con `ingressiVecchio` a ogni candidato (la strada
// lenta) contro la scorciatoia. Se divergono, tutta la colonna VECCHIO e' da buttare.
const cTest = elenco[Math.floor(elenco.length / 2)];
const lento = [];
for (let p = cTest.freezeLap + 1; p <= cTest.nGiri - 1; p += 1) {
  const a = ingressiVecchio(cTest, { pitLap: p, orizzonte: cTest.nGiri - p - 1 }).argomenti;
  const r = evaluatePit({ ...a, passo: null });
  lento.push(r?.ok ? r.ordine_previsto.find(([d]) => d === cTest.pilota)?.[1] ?? null : null);
}
const veloce = (curvaVecchio(cTest, null, cTest.nGiri).punti ?? []).map((x) => x[1]);
const C1 = lento.length === veloce.length && lento.every((x, i) => x === veloce[i]);

// —————————————————————————————————————— C2: la curva piatta e' davvero piatta?
// Fra le curve classificate PIATTE del vecchio passo=null, l'ampiezza massima in secondi.
const ampiezzePiatteVecchio = [];
const ampiezzeNonPiatteVecchio = [];
for (const r of dettaglio) {
  const x = r.per[0];
  if (x.dove === 'piatta') ampiezzePiatteVecchio.push(x.ampiezza);
  else if (x.dove !== 'muta') ampiezzeNonPiatteVecchio.push(x.ampiezza);
}

// —————————————————————————————————————— C3: senza il filtro-piattezza, cosa direbbe?
// E' il conto che il collaudo aveva stampato (f3): argmin nudo, senza guardare l'ampiezza.
const senzaFiltro = MOTORI.map(() => ({ n: 0, interni: 0, primo: 0, ultimo: 0 }));
for (const r of dettaglio) {
  for (let i = 0; i < MOTORI.length; i += 1) {
    const x = r.per[i];
    if (x.dove === 'muta') continue;
    senzaFiltro[i].n += 1;
    if (x.giroMin === x.primoGiro) senzaFiltro[i].primo += 1;
    else if (x.dove === 'ultimo') senzaFiltro[i].ultimo += 1;
    else senzaFiltro[i].interni += 1;
  }
}

// —————————————————————————————————————— la POPOLAZIONE COMUNE
// I cancelli si leggono «sugli stessi casi»: qui i casi in cui TUTTI E QUATTRO hanno una
// curva. E' la lettura che la PREREG chiede («>= 50% sugli stessi casi»).
const comuni = dettaglio.filter((r) => r.per.every((x) => x.dove !== 'muta'));
const comune = MOTORI.map((_, i) => {
  const v = comuni.map((r) => r.per[i]);
  return { n: v.length,
           piatte: v.filter((x) => x.dove === 'piatta').length,
           interni: v.filter((x) => x.dove === 'interno').length,
           primo: v.filter((x) => x.dove === 'primo').length,
           ultimo: v.filter((x) => x.dove === 'ultimo').length };
});
// Il giro del minimo coincide fra i due motori "veri" (pannello vs nuovo-legale)?
const scartiGiroMin = [];
for (const r of comuni) {
  if (r.per[1].dove !== 'muta' && r.per[3].dove !== 'muta') scartiGiroMin.push(r.per[3].giroMin - r.per[1].giroMin);
}

// —————————————————————————————————————— sensibilita': H = min(nGiri, L+15)
let corto = null;
if (!BREVE) {
  const aggC = MOTORI.map(() => vuota());
  for (const caso of elenco) {
    const H = Math.min(caso.nGiri, caso.freezeLap + 15);
    for (let i = 0; i < MOTORI.length; i += 1) accumula(aggC[i], caso, MOTORI[i][1](caso, H));
  }
  corto = aggC;
}

// ============================================================================
// REFERTO
// ============================================================================
function riga(nome, a) {
  const conRisposta = a.curve;
  return `  ${nome.padEnd(38)} curve ${String(conRisposta).padStart(3)}/${String(conRisposta + a.mute).padStart(3)}`
    + `  piatte ${String(a.piatte).padStart(3)} (${pct(a.piatte, conRisposta)})`
    + `  INTERNI ${String(a.interni).padStart(3)} (${pct(a.interni, conRisposta)})`
    + `  primo ${String(a.primo).padStart(3)} (${pct(a.primo, conRisposta)})`
    + `  ultimo ${String(a.ultimo).padStart(3)} (${pct(a.ultimo, conRisposta)})`;
}

if (JSONOUT) {
  console.log(JSON.stringify({
    n_casi: elenco.length, gare: gare().length, soglia_piatta_s: PIATTA_S,
    controlli: { C1_scorciatoia_argomenti: C1 },
    per_motore: MOTORI.map(([nome], i) => ({
      motore: nome, ...agg[i],
      ampiezza_mediana_s: mediana(agg[i].ampiezze), profondita_mediana_s: mediana(agg[i].profondita),
      ampiezze: undefined, profondita: undefined,
    })),
    senza_filtro_piattezza: MOTORI.map(([nome], i) => ({ motore: nome, ...senzaFiltro[i] })),
    popolazione_comune: MOTORI.map(([nome], i) => ({ motore: nome, ...comune[i] })),
    corto: corto && MOTORI.map(([nome], i) => ({ motore: nome, curve: corto[i].curve, mute: corto[i].mute,
      piatte: corto[i].piatte, interni: corto[i].interni, primo: corto[i].primo, ultimo: corto[i].ultimo })),
    vista_precalcolata: vista(),
  }, null, 1));
} else {
  console.log('M3 — IL «QUANDO»: DOVE CADE IL MINIMO DELLA CURVA');
  console.log(`\nCasi: ${elenco.length} soste vere su ${gare().length} gare (il perimetro del banco).`);
  console.log(`Giro finale comune H = nGiri (la bandiera), lo stesso del nuovo. Candidati: giroPit da L+1 a H-1.`);
  console.log(`Curva PIATTA = ampiezza (max-min) <= ${PIATTA_S} s: contata a parte, NON come minimo interno.`);
  console.log(`\nCONTROLLO C1 · la scorciatoia sugli argomenti del vecchio da' gli stessi numeri`);
  console.log(`  della strada lunga (ingressiVecchio a ogni candidato), su ${cTest.id}: ${C1 ? 'SI' : 'NO — RISULTATI DA BUTTARE'}`);

  console.log('\n──────────────────────────────────────────────────────────────────────');
  console.log('1 · IL CONTO PRINCIPALE (H = bandiera, ogni motore sui casi che regge)');
  console.log('──────────────────────────────────────────────────────────────────────');
  for (let i = 0; i < MOTORI.length; i += 1) console.log(riga(MOTORI[i][0], agg[i]));
  console.log('\n  ampiezza mediana della curva (max-min, s) e profondita\' mediana del minimo interno:');
  for (let i = 0; i < MOTORI.length; i += 1) {
    console.log(`  ${MOTORI[i][0].padEnd(38)} ampiezza ${f(mediana(agg[i].ampiezze)).padStart(10)} s`
      + `   profondita' del minimo interno ${f(mediana(agg[i].profondita)).padStart(10)} s`);
  }
  console.log('\n  perche\' un motore tace (i muti, per motivo):');
  for (let i = 0; i < MOTORI.length; i += 1) {
    const m = Object.entries(agg[i].motivi).sort((a, b) => b[1] - a[1]);
    if (!m.length) { console.log(`  ${MOTORI[i][0].padEnd(38)} nessuno`); continue; }
    console.log(`  ${MOTORI[i][0]}`);
    for (const [k, v] of m) console.log(`      ${String(v).padStart(3)} × ${k}`);
  }

  console.log('\n──────────────────────────────────────────────────────────────────────');
  console.log('2 · LO STESSO CONTO SENZA IL FILTRO DELLA PIATTEZZA (argmin nudo)');
  console.log('──────────────────────────────────────────────────────────────────────');
  console.log('  E\' cio\' che si legge se non si guarda l\'ampiezza: le curve piatte finiscono');
  console.log('  fra i minimi interni per rumore di virgola mobile, non per fisica.');
  for (let i = 0; i < MOTORI.length; i += 1) {
    const s = senzaFiltro[i];
    console.log(`  ${MOTORI[i][0].padEnd(38)} n ${String(s.n).padStart(3)}`
      + `  interni ${String(s.interni).padStart(3)} (${pct(s.interni, s.n)})`
      + `  primo ${String(s.primo).padStart(3)} (${pct(s.primo, s.n)})  ultimo ${String(s.ultimo).padStart(3)}`);
  }
  console.log(`\n  ampiezza delle curve del vecchio passo=null classificate PIATTE:`);
  console.log(`      n=${ampiezzePiatteVecchio.length}  massima ${ampiezzePiatteVecchio.length ? Math.max(...ampiezzePiatteVecchio).toExponential(3) : 'n/d'} s`
    + `  mediana ${ampiezzePiatteVecchio.length ? mediana(ampiezzePiatteVecchio).toExponential(3) : 'n/d'} s`);
  console.log(`  ampiezza delle NON piatte dello stesso motore: n=${ampiezzeNonPiatteVecchio.length}`
    + `  mediana ${ampiezzeNonPiatteVecchio.length ? f(mediana(ampiezzeNonPiatteVecchio)) : 'n/d'} s`);

  console.log('\n──────────────────────────────────────────────────────────────────────');
  console.log(`3 · LA POPOLAZIONE COMUNE — i ${comuni.length} casi in cui TUTTI E QUATTRO hanno una curva`);
  console.log('──────────────────────────────────────────────────────────────────────');
  for (let i = 0; i < MOTORI.length; i += 1) {
    const c = comune[i];
    console.log(`  ${MOTORI[i][0].padEnd(38)} n ${String(c.n).padStart(3)}`
      + `  piatte ${String(c.piatte).padStart(3)}  INTERNI ${String(c.interni).padStart(3)} (${pct(c.interni, c.n)})`
      + `  primo ${String(c.primo).padStart(3)} (${pct(c.primo, c.n)})  ultimo ${String(c.ultimo).padStart(3)}`);
  }
  console.log(`\n  scarto fra il giro del minimo del NUOVO(legale) e quello del VECCHIO(passo v2):`);
  console.log(`      n=${scartiGiroMin.length}  mediana ${mediana(scartiGiroMin)} giri`
    + `  |scarto| <= 2 giri in ${scartiGiroMin.filter((x) => Math.abs(x) <= 2).length} casi (${pct(scartiGiroMin.filter((x) => Math.abs(x) <= 2).length, scartiGiroMin.length)})`);

  console.log('\n──────────────────────────────────────────────────────────────────────');
  console.log('3-bis · I BUCHI NELLA CURVA E DOVE CADE IL MINIMO (tutti i casi con curva)');
  console.log('──────────────────────────────────────────────────────────────────────');
  console.log('  Un motore che non valuta i primi candidati sposta il «primo giro utile»:');
  console.log('  il minimo puo\' sembrare interno solo perche\' l\'inizio della curva manca.');
  for (let i = 0; i < MOTORI.length; i += 1) {
    const v = dettaglio.map((r) => r.per[i]).filter((x) => x.dove !== 'muta');
    const conBuchi = v.filter((x) => x.buchi > 0).length;
    const nonAlPrimo = v.filter((x) => !x.primoEDavveroIlPrimo).length;
    console.log(`  ${MOTORI[i][0].padEnd(38)} n ${String(v.length).padStart(3)}`
      + `  curve con buchi ${String(conBuchi).padStart(3)} (${pct(conBuchi, v.length)})`
      + `  primo punto != L+1 ${String(nonAlPrimo).padStart(3)}`
      + `  · ritardo mediano del minimo ${mediana(v.map((x) => x.ritardoMin))} giri dopo il congelamento`);
  }

  console.log('\n──────────────────────────────────────────────────────────────────────');
  console.log('3-ter · A DUE A DUE, sui casi in cui QUELLA COPPIA risponde');
  console.log('──────────────────────────────────────────────────────────────────────');
  console.log('  La popolazione comune a tutti e quattro (60 casi) e\' stretta dalla convenzione');
  console.log('  A del nuovo, che e\' il ramo piu\' muto. Le due coppie che contano davvero:');
  for (const [ia, ib, nota] of [[0, 3, 'il confronto LETTERALE della prereg (vecchio del banco vs nuovo)'],
                                [1, 3, 'il confronto ONESTO (pannello di produzione vs nuovo)'],
                                [1, 2, 'pannello di produzione vs nuovo COME LO SERVE IL SITO']]) {
    const cop = dettaglio.filter((r) => r.per[ia].dove !== 'muta' && r.per[ib].dove !== 'muta');
    const q = (i) => {
      const v = cop.map((r) => r.per[i]);
      return { pia: v.filter((x) => x.dove === 'piatta').length, int: v.filter((x) => x.dove === 'interno').length,
               pri: v.filter((x) => x.dove === 'primo').length };
    };
    const a = q(ia), b = q(ib);
    console.log(`\n  ${nota}   n = ${cop.length}`);
    console.log(`    ${MOTORI[ia][0].padEnd(38)} piatte ${String(a.pia).padStart(3)}  INTERNI ${String(a.int).padStart(3)} (${pct(a.int, cop.length)})  primo ${String(a.pri).padStart(3)} (${pct(a.pri, cop.length)})`);
    console.log(`    ${MOTORI[ib][0].padEnd(38)} piatte ${String(b.pia).padStart(3)}  INTERNI ${String(b.int).padStart(3)} (${pct(b.int, cop.length)})  primo ${String(b.pri).padStart(3)} (${pct(b.pri, cop.length)})`);
    const d = cop.filter((r) => r.per[ia].dove !== 'muta' && r.per[ib].dove !== 'muta')
                 .map((r) => r.per[ib].giroMin - r.per[ia].giroMin);
    console.log(`    scarto del giro del minimo (secondo − primo): mediana ${mediana(d)} giri · uguale in ${d.filter((x) => x === 0).length} casi (${pct(d.filter((x) => x === 0).length, d.length)})`);
  }

  console.log('\n──────────────────────────────────────────────────────────────────────');
  console.log('4 · PER GARA (blocchi = gare, E11: qui non si media fra gare)');
  console.log('──────────────────────────────────────────────────────────────────────');
  console.log(`  ${'gara'.padEnd(16)}` + MOTORI.map(([n]) => n.slice(0, 11).padStart(13)).join(''));
  for (const g of gare()) {
    const celle = MOTORI.map((_, i) => {
      const x = agg[i].perGara[g];
      if (!x || !x.curve) return 'muto'.padStart(13);
      return `${x.interni}/${x.curve}`.padStart(13);
    });
    console.log(`  ${g.padEnd(16)}${celle.join('')}   (interni/curve)`);
  }

  if (corto) {
    console.log('\n──────────────────────────────────────────────────────────────────────');
    console.log('5 · SENSIBILITA\': H = min(nGiri, L+15) invece della bandiera');
    console.log('──────────────────────────────────────────────────────────────────────');
    for (let i = 0; i < MOTORI.length; i += 1) console.log(riga(MOTORI[i][0], corto[i]));
  }

  console.log('\n──────────────────────────────────────────────────────────────────────');
  console.log('6 · CONTROPROVA SUL PRODOTTO VERO — la vista gia\' su disco');
  console.log('──────────────────────────────────────────────────────────────────────');
  console.log('  Non e\' il perimetro delle soste vere: e\' TUTTO cio\' che il sito mostra');
  console.log('  (ogni pilota, ogni giro di congelamento), calcolato dal motore nuovo con la');
  console.log('  convenzione A. Serve a vedere se la quota misurata sulle soste vere e\' un');
  console.log('  effetto del campione o la faccia vera del prodotto.');
  const v = vista();
  console.log(`  record totali ${v.tot} · senza_risposta ${v.senzaRisposta} · rifiutati dal Director ${v.rifiutati}`);
  console.log(`  con pannello ma CURVA VUOTA ${v.senzaCurva} (${pct(v.senzaCurva, v.senzaCurva + v.conCurva)} di chi ha un pannello)`);
  console.log(`  con curva ${v.conCurva} → piatte ${v.piatte} · INTERNI ${v.interni} (${pct(v.interni, v.conCurva)}) · primo ${v.primo} (${pct(v.primo, v.conCurva)}) · ultimo ${v.ultimo}`);

  // 7 · il troncamento di byLap sposta M3 sul vecchio? (in produzione byLap e' INTERO)
  const troncSposta = { n: 0, cambia: 0, doveIntero: { interno: 0, primo: 0, ultimo: 0, piatta: 0 } };
  for (const caso of elenco) {
    const t = curvaVecchio(caso, passoV2, caso.nGiri, true);
    const i = curvaVecchio(caso, passoV2, caso.nGiri, false);
    if (!t.punti || !i.punti) continue;
    troncSposta.n += 1;
    const ct = classifica(t.punti), ci = classifica(i.punti);
    if (ct.dove !== ci.dove) troncSposta.cambia += 1;
    troncSposta.doveIntero[ci.dove] += 1;
  }
  console.log('\n──────────────────────────────────────────────────────────────────────');
  console.log('7 · IL TRONCAMENTO DI byLap SPOSTA M3 SUL VECCHIO? (in produzione e\' INTERO)');
  console.log('──────────────────────────────────────────────────────────────────────');
  console.log(`  vecchio passo=v2, ${troncSposta.n} curve: la classificazione cambia in ${troncSposta.cambia} casi (${pct(troncSposta.cambia, troncSposta.n)})`);
  console.log(`  con byLap INTERO: interni ${troncSposta.doveIntero.interno} (${pct(troncSposta.doveIntero.interno, troncSposta.n)})`
    + ` · primo ${troncSposta.doveIntero.primo} · piatte ${troncSposta.doveIntero.piatta}`);

  console.log('\n(M3 dice DOVE cade il minimo, non se quel giro sia il giro giusto: per «il giro');
  console.log(' migliore» non esiste una verita\' — il pilota vero si e\' fermato una volta sola.)');
}
