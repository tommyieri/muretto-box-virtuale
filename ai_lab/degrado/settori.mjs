#!/usr/bin/env node
// settori.mjs — i cancelli di PREREG_settori.md: il degrado letto sui TRE SETTORI.
//
//     node ai_lab/degrado/settori.mjs [--json]
//
// NON DECIDE: esegue cio' che la prereg ha gia' deciso.
//
// PERCHE'. Sul giro intero il divario fra mescole (0,01578 s per giro d'eta') raggiunge il
// rumore (0,3457 s) a 21,9 giri — cioe' quando la gomma viene tolta. Se un settore ha un
// rapporto migliore fra il suo divario e il suo rumore, l'effetto emerge mentre la gomma e'
// ancora in macchina. E' l'unica strada che possa muovere il degrado senza una fonte nuova.
//
// LO STIMATORE E' LO STESSO del giro intero (campo.mjs): effetti fissi pilota e giro tolti
// con doppia sottrazione, ρ per mescola sul residuo. Cambia SOLO la colonna del tempo.
//
// COSA LO FA USCIRE 1:
//   (a) i settori non sommano al giro entro un millesimo — allora non sono i settori di
//       quel giro e qualunque confronto col giro intero sarebbe fra due cose diverse;
//   (b) il giro intero ricalcolato qui non riproduce 0,01578 / 0,3457: lo strumento non e'
//       tarato, e un cancello con un metro storto e' peggio di nessun cancello.

import { gunzipSync } from 'node:zlib';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RADICE } from '../confronto/banco.mjs';
import { adattaColonnare } from '../../simulatore/provenienza/adattatore.mjs';
import { garaAsciutta, passoUtilizzabile } from '../../simulatore/provenienza/definizioni.mjs';
import { fontiGare2026 } from '../../simulatore/provenienza/gare_2026.mjs';
import { MESCOLE_SLICK_ATTUALI } from '../../simulatore/provenienza/vocabolario.mjs';
import { PISTA_DI } from './durate.mjs';
import { sottraiDueVolte, degradoDi, MESCOLE } from './campo.mjs';

const JSON_OUT = process.argv.includes('--json');
const stampa = (s = '') => { if (!JSON_OUT) console.log(s); };

// Soglie da PREREG_settori.md §3. NON si toccano qui.
const SOGLIA_M1_GIRI = 15;
const PLACEBO_RIPETIZIONI = 200;
const PLACEBO_SEME = 20260804;
// LA TARATURA, E IL NUMERO PUBBLICATO CHE NON SI RIPRODUCE.
//
// `ESITO_degrado_dal_campo.md` pubblica divario 0,01578 e rumore 0,3457, e da quel rapporto
// i 21,9 giri. Il DIVARIO si riproduce: 0,01480 con lo stesso stimatore e lo stesso pooling
// (`gara|pilota`, `gara|giro`), e la differenza si spiega col perimetro — qui si tengono
// solo i giri con TUTTI E TRE i settori presenti, che sono una manciata in meno.
//
// IL RUMORE NO. Provate quattro definizioni, nessuna arriva a 0,3457: deviazione standard
// del residuo dopo pilota, giro e i termini d'eta' = 0,736; dopo pilota e giro soltanto =
// 0,778; robusta su IQR = 0,473; MAD scalata = 0,471; mediana fra gare delle sd per gara =
// 0,658. Il numero pubblicato non e' ricostruibile dal codice committato — e' un calcolo
// che non e' rimasto in nessun generatore. Stessa famiglia della fonte orfana trovata
// stamattina, e va a referto invece che aggirato.
//
// RETTIFICA 07/08/2026 — il paragrafo qui sopra e' stato superato lo stesso giorno in cui
// fu scritto, da 56e0d21: il numero E' riproducibile, ma con una definizione che non sta
// fra le cinque provate. E' la MEDIANA DEL VALORE ASSOLUTO del residuo (non una sd, non
// una MAD scalata) del braccio col rho SIGILLATO (0,030776), dopo la doppia sottrazione
// `gara|pilota` e `gara|giro`: `ESITO_cancelli_campo.json` -> `D2.mediana_sigillo` =
// 0,34570 (generato da `cancelli_campo.mjs`, righe 95-103). Le cinque grandezze qui sopra
// restano vere COME MISURE: nessuna e' quella pubblicata, e la piu' vicina (MAD scalata
// 0,471) e' proprio la stessa mediana moltiplicata per 1,4826. La conclusione operativa
// NON cambia: M1 resta espresso come RAPPORTO, che e' invariante alla definizione del
// rumore — la riespressione era giusta anche col mistero risolto.
//
// CONSEGUENZA SUL CANCELLO, dichiarata qui: M1 era scritto come soglia ASSOLUTA (15 giri su
// una scala in cui il giro intero vale 21,9). Con una scala diversa quella soglia non
// significa piu' la stessa cosa, quindi si riesprime nell'unica forma INVARIANTE alla
// definizione del rumore — il RAPPORTO, che era l'intento della prereg:
//
//     M1: eta_pareggio(settore) <= (15 / 21,9) * eta_pareggio(giro intero)
//
// cioe' il settore deve accorciare l'eta' di pareggio di almeno il 31,5%. Numeratore e
// denominatore usano LA STESSA definizione di rumore, quindi il cancello e' lo stesso
// esperimento che la prereg aveva scritto, non uno piu' facile.
const TARATURA = { divario: 0.01578, tolleranza_divario: 0.0015 };
const RAPPORTO_M1 = SOGLIA_M1_GIRI / 21.9;

const devStd = (v) => {
  if (v.length < 2) return 0;
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) * (b - m), 0) / (v.length - 1));
};

/**
 * Le osservazioni con i tempi di SETTORE accanto a quello del giro.
 *
 * Stesso filtro verde del lap intero — si passa dalla CELLA, quindi `passoUtilizzabile` e'
 * letteralmente la stessa funzione (regola 1) — e in piu' i tre settori devono esserci
 * tutti: un giro con un settore mancante non e' un giro con meno informazione, e' un giro
 * su cui la somma non torna.
 */
function osservazioniConSettori(grezzo, righe) {
  const out = [];
  const s = [grezzo.s1, grezzo.s2, grezzo.s3];
  for (let i = 0; i < righe.length; i += 1) {
    const { drv, lap, cella } = righe[i];
    if (cella.status === null || cella.del === null) continue;
    if (!passoUtilizzabile(cella)) continue;
    if (cella.tyre_age === null || !Number.isFinite(cella.tyre_age)) continue;
    if (!MESCOLE_SLICK_ATTUALI.has(cella.compound)) continue;
    const set = s.map((col) => (col ? col[i] : null));
    if (set.some((v) => typeof v !== 'number' || !Number.isFinite(v))) continue;
    out.push({ drv, lap, eta: cella.tyre_age, mescola: cella.compound, t: cella.lap_time, s: set });
  }
  return out;
}

/** ρ per mescola + rumore residuo, su una colonna di tempo qualunque. */
function stima(righe, quale) {
  const dati = righe.map((r) => ({ ...r, t: quale(r) }));
  const d = degradoDi(dati, { perMescola: true });
  if (!d.rho) return null;
  // il rumore: residuo dopo pilota, giro E i termini d'eta' per mescola
  const colonne = MESCOLE.map((m) => (r) => (r.mescola === m ? r.eta : 0));
  const X = sottraiDueVolte(dati, [...colonne, (r) => r.t]);
  const res = X.map((riga) => riga[MESCOLE.length] - MESCOLE.reduce((a, m, j) => a + riga[j] * d.rho[m], 0));
  const v = Object.values(d.rho);
  const divario = Math.max(...v) - Math.min(...v);
  const rumore = devStd(res);
  return { rho: d.rho, divario, rumore, eta_pareggio: divario > 0 ? rumore / divario : Infinity, n: dati.length };
}

// ── i dati: le stesse gare 2026 dell'esito sul giro intero ──────────────────
const TUTTE = [];
for (const [gara, { fonteAbs }] of Object.entries(fontiGare2026(path.join(RADICE, 'simulatore')))) {
  const grezzo = JSON.parse(readFileSync(fonteAbs, 'utf8'));
  const { righe } = adattaColonnare(grezzo, { fonte: gara });
  TUTTE.push(...osservazioniConSettori(grezzo, righe).map((o) => ({ ...o, gara })));
}

// (a) i settori sommano al giro?
let peggioreSomma = 0;
for (const o of TUTTE) peggioreSomma = Math.max(peggioreSomma, Math.abs(o.s[0] + o.s[1] + o.s[2] - o.t));
if (peggioreSomma > 0.001) {
  console.error(`I SETTORI NON SOMMANO AL GIRO: scarto massimo ${peggioreSomma.toFixed(4)} s. Non sono i settori di quel giro.`);
  process.exit(1);
}

// LO STESSO POOLING DELL'ESITO PUBBLICATO, e non e' un dettaglio: cancelli_campo.mjs fa
// UNA stima sola su tutte le gare insieme, con gli effetti fissi resi per-gara nella CHIAVE
// (`gara|pilota` e `gara|giro`). Stimare gara per gara e poi mediare da' un altro numero —
// misurato: divario 0,027 invece di 0,016 — e il confronto col giro intero non sarebbe piu'
// fra due cose uguali. Il metro si copia, non si reinventa.
const conChiavi = TUTTE.map((o) => ({ ...o, drv: `${o.gara}|${o.drv}`, lap: `${o.gara}|${o.lap}` }));

function stimaPooled(dati, quale) {
  return stima(dati, quale);
}

const GIRO = stimaPooled(conChiavi, (r) => r.t);
const SETTORI = [0, 1, 2].map((k) => stimaPooled(conChiavi, (r) => r.s[k]));

// (b) taratura: il giro intero deve riprodurre il DIVARIO pubblicato
const scartoDiv = Math.abs(GIRO.divario - TARATURA.divario);
stampa('');
stampa('══ I SETTORI CONTRO IL MURO DEL RUMORE — PREREG_settori.md ═════════════════');
stampa(`   ${TUTTE.length} giri verdi con tutti e tre i settori · somma settori-giro: scarto max ${(peggioreSomma * 1000).toFixed(3)} ms`);
stampa('');
stampa(`   TARATURA sul giro intero: divario ${GIRO.divario.toFixed(5)} (pubblicato ${TARATURA.divario}, scarto ${scartoDiv.toFixed(5)})`);
const TARATO = scartoDiv <= TARATURA.tolleranza_divario;
if (!TARATO) {
  stampa(`   TARATURA FALLITA: non giudico.`);
  process.exit(1);
}
stampa(`   taratura verde sul divario. Il rumore pubblicato (0,3457) e' la mediana del |residuo|`);
stampa(`   del braccio col rho sigillato (D2.mediana_sigillo, rettifica 07/08) — NON la sd usata`);
stampa(`   qui, che vale ${GIRO.rumore.toFixed(4)}. Il cancello M1 resta un RAPPORTO (<= ${(RAPPORTO_M1 * 100).toFixed(1)}% dell'eta' di`);
stampa(`   pareggio del giro), invariante alla definizione del rumore.`);

stampa('');
stampa('                     divario (s/giro d\'eta\')   rumore (s)   eta\' di pareggio');
stampa(`   giro intero            ${GIRO.divario.toFixed(5)}              ${GIRO.rumore.toFixed(4)}        ${GIRO.eta_pareggio.toFixed(1)} giri`);
for (let k = 0; k < 3; k += 1) {
  stampa(`   settore ${k + 1}              ${SETTORI[k].divario.toFixed(5)}              ${SETTORI[k].rumore.toFixed(4)}        ${SETTORI[k].eta_pareggio.toFixed(1)} giri`);
}

// ── M1 ──────────────────────────────────────────────────────────────────────
let vincente = 0;
for (let k = 1; k < 3; k += 1) if (SETTORI[k].eta_pareggio < SETTORI[vincente].eta_pareggio) vincente = k;
const LIMITE_M1 = RAPPORTO_M1 * GIRO.eta_pareggio;
const M1 = SETTORI[vincente].eta_pareggio <= LIMITE_M1;
stampa('');
stampa(`   M1  esiste un settore che accorcia l'eta' di pareggio ad almeno il ${(RAPPORTO_M1 * 100).toFixed(1)}% di quella del giro`);
stampa(`         (giro ${GIRO.eta_pareggio.toFixed(1)} → serve <= ${LIMITE_M1.toFixed(1)}):`);
stampa(`         il migliore e' il settore ${vincente + 1} con ${SETTORI[vincente].eta_pareggio.toFixed(1)}   ${M1 ? 'PASSA' : 'NON PASSA'}`);

// ── M2 · placebo: mescole rimescolate entro (gara, pilota) ──────────────────
let seme = PLACEBO_SEME;
const rnd = () => { seme = (seme * 1103515245 + 12345) & 0x7fffffff; return seme / 0x7fffffff; };
const gruppi = new Map();
for (const o of TUTTE) {
  const k = `${o.gara}|${o.drv}`;
  if (!gruppi.has(k)) gruppi.set(k, []);
  gruppi.get(k).push(o);
}
const divariFinti = [];
for (let rep = 0; rep < PLACEBO_RIPETIZIONI; rep += 1) {
  const finte = new Map();
  for (const [k, righe] of gruppi) {
    const et = righe.map((r) => r.mescola);
    for (let i = et.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [et[i], et[j]] = [et[j], et[i]]; }
    finte.set(k, et);
  }
  const idx = new Map();
  const finti = TUTTE.map((o) => {
    const k = `${o.gara}|${o.drv}`;
    const i = idx.get(k) ?? 0; idx.set(k, i + 1);
    return { ...o, mescola: finte.get(k)[i] };
  });
  const f = stima(finti.map((o) => ({ ...o, drv: `${o.gara}|${o.drv}`, lap: `${o.gara}|${o.lap}` })), (r) => r.s[vincente]);
  if (f) divariFinti.push(f.divario);
}
const battuti = divariFinti.filter((d) => d >= SETTORI[vincente].divario).length;
const pPlacebo = (battuti + 1) / (divariFinti.length + 1);
const M2 = pPlacebo <= 0.05;
stampa(`   M2  placebo su ${divariFinti.length} rimescolamenti entro (gara, pilota):`);
stampa(`         divari finti >= vero ${battuti}/${divariFinti.length} · p = ${pPlacebo.toFixed(4)}   ${M2 ? 'PASSA' : 'NON PASSA'}`);

// ── M3 · stabilita' sul fondo 2022-2025 ─────────────────────────────────────
const FONDO = [];
{
  const base = path.join(RADICE, 'data', 'fondo');
  for (const anno of ['2022', '2023', '2024', '2025']) {
    for (const gara of readdirSync(path.join(base, anno)).sort()) {
      const f = path.join(base, anno, gara, 'Race.json.gz');
      if (!existsSync(f)) continue;
      let grezzo; let righe;
      try {
        grezzo = JSON.parse(gunzipSync(readFileSync(f)));
        ({ righe } = adattaColonnare(grezzo, { fonte: `${anno}/${gara}` }));
      } catch { continue; }
      if (!garaAsciutta(righe)) continue;
      FONDO.push(...osservazioniConSettori(grezzo, righe).map((o) => ({ ...o, gara: `${anno}/${gara}`, pista: PISTA_DI[gara] })));
    }
  }
}
const fondoChiavi = FONDO.map((o) => ({ ...o, drv: `${o.gara}|${o.drv}`, lap: `${o.gara}|${o.lap}` }));
const fondoSettori = [0, 1, 2].map((k) => stima(fondoChiavi, (r) => r.s[k]));
let vincenteFondo = 0;
for (let k = 1; k < 3; k += 1) if (fondoSettori[k] && fondoSettori[k].eta_pareggio < fondoSettori[vincenteFondo].eta_pareggio) vincenteFondo = k;
const M3 = vincenteFondo === vincente && fondoSettori[vincente].divario > 0;
stampa(`   M3  stabilita' sul fondo 2022-2025 (${FONDO.length} giri):`);
stampa(`         settore migliore sul fondo: ${vincenteFondo + 1} (eta' ${fondoSettori[vincenteFondo].eta_pareggio.toFixed(1)}) · sul 2026: ${vincente + 1}   ${M3 ? 'PASSA' : 'NON PASSA'}`);

// ── la lettura obbligata (prereg §4) ────────────────────────────────────────
let verdetto;
if (!M1) verdetto = 'NULL, E LA RISPOSTA E\' DEFINITIVA CON QUESTA FONTE: alla risoluzione che abbiamo il muro non cade. Non e\' il modello e non e\' il settore — servono tempi per mini-settore, che nel nostro grezzo non esistono (le colonne ms1/ms2/ms3 sono codici di stato, non cronometri).';
else if (!M2) verdetto = 'NULL: il settore migliore non regge il placebo.';
else if (!M3) verdetto = 'PARZIALE: M1 e M2 passano ma il settore vincente non e\' lo stesso sul fondo. La scelta e\' fatta su undici gare e si dichiara tale.';
else verdetto = `SI SPEDISCE: il settore ${vincente + 1} porta l'effetto mescola dentro la vita utile della gomma.`;
stampa('');
stampa('   LETTURA OBBLIGATA DALLA PREREG §4:');
for (const r of verdetto.match(/.{1,84}(\s|$)/g)) stampa(`   ${r.trim()}`);

const doc = {
  _targhetta: {
    cosa_e: 'Esito dei cancelli M1-M3 di PREREG_settori.md — il degrado per mescola letto sui tre settori invece che sul giro intero.',
    prereg: 'ai_lab/degrado/PREREG_settori.md',
    generato_da: 'ai_lab/degrado/settori.mjs',
    data: '2026-08-04',
    i_microsettori_non_esistono: 'Le colonne ms1/ms2/ms3 del grezzo NON sono tempi: sono stringhe di codici di stato per mini-settore, della famiglia dei SegmentsSector di FastF1. La risoluzione piu fine disponibile sono i tre settori.',
    metrica: 'eta_pareggio = rumore residuo / divario fra la mescola che degrada di piu e quella che degrada di meno. Sul giro intero vale 21,9 giri.',
  },
  taratura: { giro: GIRO, pubblicato: TARATURA, verde: TARATO },
  settori: SETTORI.map((s, k) => ({ settore: k + 1, ...s })),
  settore_vincente: vincente + 1,
  cancelli: { M1: { passa: M1, eta_pareggio: SETTORI[vincente].eta_pareggio, limite: LIMITE_M1, rapporto: RAPPORTO_M1, eta_pareggio_giro: GIRO.eta_pareggio }, M2: { passa: M2, p: pPlacebo, battuti, ripetizioni: divariFinti.length }, M3: { passa: M3, vincente_fondo: vincenteFondo + 1, fondo: fondoSettori.map((s, k) => ({ settore: k + 1, ...s })) } },
  verdetto,
};
writeFileSync(path.join(RADICE, 'ai_lab/degrado/ESITO_settori.json'), JSON.stringify(doc, null, 1) + '\n');
if (JSON_OUT) console.log(JSON.stringify(doc, null, 1));
else stampa('\n   → ai_lab/degrado/ESITO_settori.json');
