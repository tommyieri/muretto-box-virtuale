#!/usr/bin/env node
// esporta_soste_sotto_sc.mjs — CHI SI FERMA sotto Safety Car, misurato invece che dedotto.
//
//     node provenienza/esporta_soste_sotto_sc.mjs [--write]
//
// Il motore oggi lo decide con `stint !== 1`: azzecca 25 rivali su 148 (16,9%) e a
// Monaco ne prevede ZERO mentre 360 entrano davvero. Non e' un parametro tarato
// male — e' un'assunzione di fisica messa a rispondere a una domanda che di fisica
// non e'. Chi si ferma sotto Safety Car e' una DECISIONE di muretto, e le decisioni
// si misurano guardando cosa la gente ha fatto.
//
// Protocollo e cancello: ai_lab/confronto/PREREG_chi_si_ferma.md, scritto prima.
//
// COSA GUARDA. Per ogni auto e ogni giro L in cui il CAMPO e' neutralizzato
// (criterio PREREG-6: almeno meta' delle auto sotto regime), se quell'auto entra ai
// box entro L+2. Due giri e non uno: la corsia si apre e la fila si forma, e chi
// decide al giro L materialmente entra a L+1 o L+2.
//
// TUTTE le variabili sono note AL CONGELAMENTO. Nessuna viene dal futuro (E14).

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { adattaColonnare } from './adattatore.mjs';
import { regimeDiCella } from './definizioni.mjs';
import { MESCOLE_BAGNATO } from './vocabolario.mjs';

export const PERCORSO = 'data/viste/soste_sotto_sc.json';
const QUOTA_CAMPO = 0.5;   // PREREG-6: sotto meta' del campo non e' una neutralizzazione di campo
const FINESTRA = 2;        // entra ai box entro L+2
const MIN_AUTO = 6;

const perc = (a, b) => (b ? Number((100 * a / b).toFixed(1)) : null);

export function costruisci(radice) {
  const base = path.join(radice, 'data', 'fondo');
  const occasioni = [];   // una per (gara, auto, giro sotto SC di campo)
  const scarti = {};
  const scarta = (m) => { scarti[m] = (scarti[m] ?? 0) + 1; };

  for (const anno of readdirSync(base).filter((a) => /^\d{4}$/.test(a)).sort()) {
    for (const gara of readdirSync(path.join(base, anno)).sort()) {
      const f = path.join(base, anno, gara, 'Race.json.gz');
      if (!existsSync(f)) continue;
      let righe;
      try { ({ righe } = adattaColonnare(JSON.parse(gunzipSync(readFileSync(f))), { fonte: `${anno}/${gara}` })); } catch { continue; }
      if (righe.some(({ cella }) => MESCOLE_BAGNATO.has(cella.compound))) { scarta('gara bagnata'); continue; }

      const perPilota = new Map();
      let nGiri = 0;
      for (const { drv, lap, cella } of righe) {
        if (!perPilota.has(drv)) perPilota.set(drv, new Map());
        perPilota.get(drv).set(lap, cella);
        if (lap > nGiri) nGiri = lap;
      }
      const chiave = `${anno}/${gara}`;

      for (let L = 2; L <= nGiri - 2; L += 1) {
        // il campo e' neutralizzato?
        const alGiro = [];
        for (const [drv, celle] of perPilota) {
          const c = celle.get(L);
          if (c && c.status !== null && c.status !== undefined) alGiro.push({ drv, c });
        }
        if (alGiro.length < MIN_AUTO) continue;
        let neutri = 0;
        for (const { c } of alGiro) { let r = null; try { r = regimeDiCella(c); } catch { r = null; } if (r !== null) neutri += 1; }
        if (neutri / alGiro.length < QUOTA_CAMPO) continue;

        // la posizione al giro L, fra chi ha cum
        const conCum = alGiro.filter((x) => typeof x.c.cum_time === 'number').sort((a, b) => a.c.cum_time - b.c.cum_time);
        const posDi = new Map(conCum.map((x, i) => [x.drv, i + 1]));

        for (const { drv, c } of alGiro) {
          if (c.tyre_age === null || c.tyre_age === undefined) { scarta('eta gomma assente'); continue; }
          // il BERSAGLIO: entra ai box entro L+FINESTRA
          let siFerma = false;
          for (let k = 1; k <= FINESTRA; k += 1) {
            const cc = perPilota.get(drv)?.get(L + k);
            if (cc?.in_lap === true) { siFerma = true; break; }
          }
          occasioni.push({
            gara: chiave, anno: Number(anno), circuito: gara, drv,
            lap: L, frazione: Number((L / nGiri).toFixed(3)),
            eta: c.tyre_age, stint: c.stint ?? null,
            posizione: posDi.get(drv) ?? null, su: conCum.length,
            si_ferma: siFerma,
          });
        }
      }
    }
  }

  // ── quanto separa ogni variabile ────────────────────────────────────────────
  const tasso = (v) => perc(v.filter((x) => x.si_ferma).length, v.length);
  const fascia = (etichette, f2) => {
    const o = {};
    for (const [nome, test] of etichette) {
      const v = occasioni.filter(f2 ? (x) => f2(x) && test(x) : test);
      if (v.length < 30) continue;
      o[nome] = { n: v.length, si_ferma: tasso(v), n_gare: new Set(v.map((x) => x.gara)).size };
    }
    return o;
  };

  const perCircuito = {};
  for (const c of new Set(occasioni.map((x) => x.circuito))) {
    const v = occasioni.filter((x) => x.circuito === c);
    if (v.length < 40) continue;
    perCircuito[c] = { n: v.length, si_ferma: tasso(v), n_gare: new Set(v.map((x) => x.gara)).size };
  }

  return {
    _targhetta: {
      tipo: 'MISURATO sul fondo — chi entra ai box sotto neutralizzazione di campo',
      domanda: 'dato il campo neutralizzato al giro L, questa auto entra ai box entro L+2?',
      criterio_campo: `almeno il ${QUOTA_CAMPO * 100}% delle auto sotto regime al giro L (PREREG-6)`,
      variabili: 'tutte note al congelamento: eta gomma, stint, posizione, frazione di gara, circuito. Nessuna dal futuro (E14)',
      linea_di_base: 'la regola di oggi (`stint !== 1`) azzecca 25 rivali su 148 = 16,9%',
      protocollo: 'ai_lab/confronto/PREREG_chi_si_ferma.md',
      prodotto_da: 'provenienza/esporta_soste_sotto_sc.mjs',
      non_promuove: 'questa e\' una VISTA. Il cancello per sostituire la regola sta nella prereg.',
    },
    n_occasioni: occasioni.length,
    n_gare: new Set(occasioni.map((x) => x.gara)).size,
    scarti,
    tasso_complessivo: tasso(occasioni),
    per_eta: fascia([
      ['0-4', (x) => x.eta <= 4], ['5-9', (x) => x.eta >= 5 && x.eta <= 9],
      ['10-14', (x) => x.eta >= 10 && x.eta <= 14], ['15-19', (x) => x.eta >= 15 && x.eta <= 19],
      ['20-29', (x) => x.eta >= 20 && x.eta <= 29], ['30+', (x) => x.eta >= 30],
    ]),
    per_stint: fascia([['1', (x) => x.stint === 1], ['2', (x) => x.stint === 2], ['3+', (x) => x.stint >= 3]]),
    per_posizione: fascia([
      ['P1-P5', (x) => x.posizione !== null && x.posizione <= 5],
      ['P6-P10', (x) => x.posizione !== null && x.posizione > 5 && x.posizione <= 10],
      ['P11+', (x) => x.posizione !== null && x.posizione > 10],
    ]),
    per_frazione: fascia([
      ['0-25%', (x) => x.frazione <= 0.25], ['25-50%', (x) => x.frazione > 0.25 && x.frazione <= 0.5],
      ['50-75%', (x) => x.frazione > 0.5 && x.frazione <= 0.75], ['75-100%', (x) => x.frazione > 0.75],
    ]),
    per_circuito: perCircuito,
    // l'incrocio che il prodotto usa davvero: eta x stint
    eta_per_stint: {
      stint1: fascia([['eta 0-9', (x) => x.eta <= 9], ['eta 10-19', (x) => x.eta >= 10 && x.eta <= 19], ['eta 20+', (x) => x.eta >= 20]], (x) => x.stint === 1),
      stint2plus: fascia([['eta 0-9', (x) => x.eta <= 9], ['eta 10-19', (x) => x.eta >= 10 && x.eta <= 19], ['eta 20+', (x) => x.eta >= 20]], (x) => x.stint >= 2),
    },
  };
}

function main() {
  const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const v = costruisci(radice);
  const riga = (n, x) => `    ${n.padEnd(12)} n=${String(x.n).padStart(6)}  gare ${String(x.n_gare).padStart(3)}  si ferma ${String(x.si_ferma).padStart(5)}%`;
  console.log(`CHI SI FERMA SOTTO SAFETY CAR — ${v.n_occasioni} occasioni su ${v.n_gare} gare del fondo`);
  console.log(`  tasso complessivo: ${v.tasso_complessivo}%   ·   la regola di oggi (stint !== 1) azzecca il 16,9%`);
  for (const [titolo, blocco] of [['ETA GOMMA', v.per_eta], ['STINT', v.per_stint], ['POSIZIONE', v.per_posizione], ['FRAZIONE DI GARA', v.per_frazione]]) {
    console.log(`\n  ${titolo}`);
    for (const [n, x] of Object.entries(blocco)) console.log(riga(n, x));
  }
  console.log('\n  ETA DENTRO LO STINT 1 (chi non si e\' ancora fermato)');
  for (const [n, x] of Object.entries(v.eta_per_stint.stint1)) console.log(riga(n, x));
  console.log('  ETA DENTRO LO STINT 2+ (chi si e\' gia\' fermato)');
  for (const [n, x] of Object.entries(v.eta_per_stint.stint2plus)) console.log(riga(n, x));
  console.log('\n  PER CIRCUITO (i cinque piu\' alti e i cinque piu\' bassi)');
  const c = Object.entries(v.per_circuito).sort((a, b) => b[1].si_ferma - a[1].si_ferma);
  for (const [n, x] of c.slice(0, 5)) console.log(riga(n, x));
  console.log('    ...');
  for (const [n, x] of c.slice(-5)) console.log(riga(n, x));
  if (process.argv.includes('--write')) {
    writeFileSync(path.join(radice, PERCORSO), `${JSON.stringify(v, null, 1)}\n`);
    console.log(`\n  scritto: ${PERCORSO}`);
  }
}
if (import.meta.url === `file://${process.argv[1]}`) main();
