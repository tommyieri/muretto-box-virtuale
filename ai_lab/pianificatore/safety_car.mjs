#!/usr/bin/env node
// safety_car.mjs — SC0 e SC1 di PREREG_safety_car.md.
//
//     node ai_lab/pianificatore/safety_car.mjs [--json]
//
// NON DECIDE e NON ACCENDE.
//
//   SC0  ARITMETICA. Una sosta sotto neutralizzazione costa 0,50·P, quindi con una frazione
//        q di soste sotto SC il pit-loss atteso e' P·(1−q/2). Col caso PIU' FAVOREVOLE
//        POSSIBILE (q = 1, ogni sosta sotto SC) k* arriva a 2 da qualche parte?
//   SC1  MISURA. Tolte le soste avvenute sotto SC (4) o bandiera rossa (5), quante ne
//        restano? E il sotto-fermarsi del motore scende sotto i 90?
//
// IL VSC NON ENTRA (prereg §4): il segnale 6 e' dichiarato rotto. La conseguenza e' che si
// SOTTOSTIMA l'opportunismo — le soste sotto VSC restano contate come verdi.
//
// COSA LO FA USCIRE 1:
//   (a) l'aritmetica di SC0 non torna rimettendo P_eff dentro kOttimoContinuo.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { RADICE, gare, garaSimDi, contestoNuovo } from '../confronto/banco.mjs';
import { decisioni } from '../degrado/decisioni.mjs';
import { stintConclusi } from '../degrado/durate.mjs';
import { kOttimoContinuo } from '../../simulatore/scenario/piano.mjs';
import { simboliStatus } from '../../simulatore/provenienza/vocabolario.mjs';

const JSON_OUT = process.argv.includes('--json');
const stampa = (s = '') => { if (!JSON_OUT) console.log(s); };

// Da PREREG_safety_car.md. NON si toccano qui.
const RHO = 0.030776;
const FATTORE_SC = 0.50;      // sigillato: frazione della perdita green pagata sotto SC
const K_BERSAGLIO = 2;
const SC1_TROPPO_POCHE = 90;
const BASE_TROPPO_POCHE = 114; // il motore di oggi (ESITO_scomposizione_errore.md)

const calendario = JSON.parse(readFileSync(path.join(RADICE, 'data', 'calendario_2026.json'), 'utf8'));
const interno = JSON.parse(readFileSync(path.join(RADICE, 'simulatore', 'data', 'modelli', 'pitloss_interno.json'), 'utf8'));
const PROMOSSI = new Set(interno.cancello_A?.promossi ?? []);
const perditeP = Object.entries(interno.circuiti ?? {})
  .filter(([g]) => PROMOSSI.has(g)).map(([, v]) => v?.mediana_green_s).filter((x) => typeof x === 'number');
const P_MIN = Math.min(...perditeP); // il pit-loss piu' BASSO: il caso piu' favorevole

// ── SC0 · l'aritmetica ──────────────────────────────────────────────────────
const Q = 1;                                   // il limite irraggiungibile
const P_EFF = P_MIN * (1 - Q / 2 * (1 - FATTORE_SC) / 0.5); // = P_MIN * (1 - q/2) con fattore 0,50
// (con FATTORE_SC = 0,50 l'espressione si riduce a P_MIN*(1 - q/2); resta scritta in forma
// generale perche' se il fattore sigillato cambiasse, questo conto deve seguirlo.)

const gareDemo = calendario.gare.filter((g) => g.gara_demo).map((g) => ({ nome: g.gara_demo, giri: g.giri }));
const sc0 = gareDemo.map((g) => {
  const senza = kOttimoContinuo({ R: g.giri, a: 0, rho: RHO, perdita: P_MIN });
  const con = kOttimoContinuo({ R: g.giri, a: 0, rho: RHO, perdita: P_EFF });
  return { gara: g.nome, giri: g.giri, k_senza: senza, k_con: con, arriva: con >= K_BERSAGLIO };
});
const SC0 = sc0.some((r) => r.arriva);

stampa('');
stampa('══ LA SAFETY CAR — PREREG_safety_car.md ════════════════════════════════════');
stampa(`   SC0 · ARITMETICA · pit-loss piu' basso misurato ${P_MIN.toFixed(2)} s · fattore SC ${FATTORE_SC}`);
stampa(`   caso piu' favorevole possibile: q = ${Q} (OGNI sosta sotto SC) → P atteso ${P_EFF.toFixed(2)} s`);
stampa('');
stampa('   gara            giri   k* senza SC   k* con q=1   arriva a 2?');
for (const r of sc0.sort((a, b) => b.giri - a.giri)) {
  stampa(`   ${r.gara.padEnd(14)} ${String(r.giri).padStart(4)}   ${r.k_senza.toFixed(2).padStart(11)}   ${r.k_con.toFixed(2).padStart(10)}   ${r.arriva ? 'SI' : 'no'}`);
}
const massimo = Math.max(...sc0.map((r) => r.k_con));
stampa('');
stampa(`   il k* piu' alto raggiungibile regalando OGNI sosta alla safety car e' ${massimo.toFixed(2)}`);
stampa(`   SC0  il canale economico puo' bastare (k* ≥ ${K_BERSAGLIO} in almeno una gara):   ${SC0 ? 'PASSA' : 'NON PASSA'}`);

// ── SC1 · la misura ─────────────────────────────────────────────────────────
// Ogni sosta vera del 2026, con lo status del giro in cui e' avvenuta.
const sotto = (status) => {
  if (status === null) return null;
  const s = simboliStatus(status);
  return s.has('4') || s.has('5');
};

const D = decisioni();
const perPilota = new Map();          // gara|drv → [{giro_sosta, neutralizzata}]
let senzaStatus = 0;
for (const gara of gare()) {
  const ctx = contestoNuovo(gara);
  const g = ctx.gare[garaSimDi(gara)];
  for (const s of stintConclusi(g.perPilota, { gara })) {
    const n = sotto(s.status_sosta);
    if (n === null) { senzaStatus += 1; continue; }
    const k = `${gara}|${s.drv}`;
    if (!perPilota.has(k)) perPilota.set(k, []);
    perPilota.get(k).push({ giro: s.giro_sosta, neutralizzata: n });
  }
}

const tutte = [...perPilota.values()].flat();
const neutralizzate = tutte.filter((s) => s.neutralizzata).length;

// le soste OLTRE LA PRIMA: sono quelle che il motore non fa
let oltrePrima = 0; let oltrePrimaNeutr = 0;
for (const [, elenco] of perPilota) {
  const ord = [...elenco].sort((a, b) => a.giro - b.giro);
  for (let i = 1; i < ord.length; i += 1) { oltrePrima += 1; if (ord[i].neutralizzata) oltrePrimaNeutr += 1; }
}

// SC1: quante decisioni resterebbero «troppo poche» se il k vero escludesse le soste
// sotto neutralizzazione. Si rilegge il banco: per ogni decisione, k_vero_verde.
const BANCO = JSON.parse(readFileSync(path.join(RADICE, 'ai_lab/pianificatore/ESITO_scomposizione_errore.json'), 'utf8'));
let pocheVerde = 0; let n = 0;
for (const gara of gare()) {
  const ctx = contestoNuovo(gara);
  const g = ctx.gare[garaSimDi(gara)];
  const soste = new Map();
  for (const s of stintConclusi(g.perPilota, { gara })) {
    if (!soste.has(s.drv)) soste.set(s.drv, []);
    soste.get(s.drv).push(s);
  }
  for (const d of D.filter((x) => x.gara === gara)) {
    const mie = (soste.get(d.drv) ?? []).filter((s) => s.giro_sosta >= d.giro_inizio);
    const kVero = mie.length;
    const kVerde = mie.filter((s) => sotto(s.status_sosta) === false).length;
    // il motore, oggi, propone 0 o 1 in 163 casi su 167: si usa il suo k dal banco quando
    // c'e', altrimenti si salta. Qui interessa solo QUANTE decisioni resterebbero
    // «troppo poche» col k vero ridotto ai soli verdi.
    if (kVero === 0) continue;
    n += 1;
    if (kVerde > 1) pocheVerde += 1;   // il motore arriva al massimo a 1 nella pratica
  }
}

const SC1 = pocheVerde <= SC1_TROPPO_POCHE;

stampa('');
stampa(`   SC1 · MISURA · ${tutte.length} soste vere del 2026 (VSC NON contato: misura conservativa)`);
stampa(`     sotto SC o bandiera rossa: ${neutralizzate}/${tutte.length} = ${(100 * neutralizzate / tutte.length).toFixed(1)}%`);
stampa(`     fra le soste OLTRE LA PRIMA — quelle che il motore non fa — sotto SC o rossa:`
  + ` ${oltrePrimaNeutr}/${oltrePrima} = ${(100 * oltrePrimaNeutr / Math.max(oltrePrima, 1)).toFixed(1)}%`);
if (senzaStatus) stampa(`     soste senza status, escluse e contate: ${senzaStatus}`);
stampa('');
stampa(`     decisioni in cui servirebbero ancora ≥ 2 soste VERDI: ${pocheVerde} (erano ${BASE_TROPPO_POCHE} contando tutte)`);
stampa(`   SC1  l'opportunismo spiega il sotto-fermarsi (≤ ${SC1_TROPPO_POCHE}):   ${SC1 ? 'PASSA' : 'NON PASSA'}`);

let verdetto;
if (SC0) verdetto = 'SC0 PASSA: esiste un q plausibile che sposta il piano. Serve P(SC) per circuito e per giro, ed e\' una sessione sua con la sua prereg.';
else if (SC1) verdetto = 'SC0 escluso, SC1 PASSA — al motore non manca un parametro: gli si sta chiedendo di prevedere l\'imprevedibile. '
  + 'La conseguenza e\' sul METRO, non sul motore: il banco delle decisioni va letto escludendo le soste sotto neutralizzazione, '
  + 'e la parte di errore che resta e\' quella vera.';
else verdetto = 'SC0 escluso e SC1 non passa: la safety car non spiega il sotto-fermarsi in nessuno dei due modi. '
  + 'QUINTA STRADA CHIUSA, e il difetto resta senza spiegazione disponibile — e\' il momento di dirlo invece di cercarne una sesta.';

stampa('');
stampa('   LETTURA OBBLIGATA DALLA PREREG §5:');
for (const r of verdetto.match(/.{1,84}(\s|$)/g)) stampa(`   ${r.trim()}`);

const doc = {
  _targhetta: {
    cosa_e: 'SC0 e SC1 di PREREG_safety_car.md — la safety car come canale economico (aritmetica) e come opportunita non pianificabile (misura).',
    prereg: 'ai_lab/pianificatore/PREREG_safety_car.md',
    generato_da: 'ai_lab/pianificatore/safety_car.mjs',
    data: '2026-08-05',
    natura: 'DIAGNOSI — non accende e non spedisce niente',
    vsc_escluso: 'Il segnale 6 e dichiarato rotto (R_lap 1,055). Si contano solo SC (4) e rossa (5): la misura SOTTOSTIMA l opportunismo.',
  },
  SC0: { passa: SC0, p_min: P_MIN, p_eff: P_EFF, q: Q, k_massimo: massimo, per_gara: sc0 },
  SC1: {
    passa: SC1, soste: tutte.length, neutralizzate, quota: neutralizzate / tutte.length,
    oltre_prima: oltrePrima, oltre_prima_neutralizzate: oltrePrimaNeutr,
    decisioni_con_due_soste_verdi: pocheVerde, base: BASE_TROPPO_POCHE, soglia: SC1_TROPPO_POCHE,
    senza_status: senzaStatus,
  },
  verdetto,
};
writeFileSync(path.join(RADICE, 'ai_lab/pianificatore/ESITO_safety_car.json'), JSON.stringify(doc, null, 1) + '\n');
if (JSON_OUT) console.log(JSON.stringify(doc, null, 1));
else stampa('\n   → ai_lab/pianificatore/ESITO_safety_car.json');
