#!/usr/bin/env node
// replay_g5.mjs — il cancello causale G5, eseguito ESATTAMENTE come
// pre-registrato in banco/prereg/PREREG_G5.md. Le gare vengono rigiocate dal
// grezzo pinnato ATTRAVERSO IL PERCORSO LIVE (feed d'archivio → collettore),
// non attraverso l'adattatore di replay: è il calibratore come lo userà il
// vivo, e la parità s18 garantisce che i due percorsi coincidano.
//
// Uso: node banco/replay_g5.mjs   → riscrive banco/prereg/ESITO_G5.json

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { caricaGare2026, osservazioniVerdi, indicizza } from '../provenienza/gare_2026.mjs';
import { passoUtilizzabile } from '../provenienza/definizioni.mjs';
import { creaPasso, stimaBasi } from '../engine/passo_v2.mjs';
import { raccogliCelle } from '../live/collettore.mjs';
import { feedDaGara } from '../live/feed_archivio.mjs';
import { calibraDegrado } from '../live/calibrazione.mjs';
import { mediana } from './misure/bias.mjs';

// parametri PRE-REGISTRATI (PREREG_G5.md) — cambiarli qui senza cambiare la
// prereg è riscrivere il cancello dopo l'esito
const CONGELAMENTI = [15, 25, 35];
const MIN_GIRI_BERSAGLIO = 30;
const MIN_GARE = 5;
const MIN_GIRI_BASE = 8;

export function eseguiG5(radice, gare) {
  const modello = JSON.parse(readFileSync(path.join(radice, 'data', 'modelli', 'modello_v2.json'), 'utf8'));
  const rho = modello.rho.valore;
  const delta70 = modello.delta_70.scelto;

  const perCongelamento = {};
  const dettaglio = [];
  for (const Lf of CONGELAMENTI) {
    const delte = [];
    for (const [nome, garaArchivio] of Object.entries(gare)) {
      // il percorso LIVE: feed → collettore → celle
      const { righe } = raccogliCelle(feedDaGara(garaArchivio), { fonteStatus: 'per_auto' });
      const gara = indicizza(righe);
      if (Lf >= gara.nGiri) continue;

      const calibrazione = calibraDegrado(righe, { finoA: Lf, rho, delta70, nGiri: gara.nGiri });
      const moltiplicatore = calibrazione.moltiplicatore ?? 1;
      const osservazioni = osservazioniVerdi(righe);

      const bracci = { statico: rho, live: rho * moltiplicatore };
      const mae = {};
      let nBersagli = null;
      for (const [braccio, rhoEff] of Object.entries(bracci)) {
        // regola 10: la base di ogni braccio si stima col SUO rho effettivo
        const basi = stimaBasi(osservazioni, { delta70, rho: rhoEff, nGiri: gara.nGiri, finoA: Lf, minGiri: MIN_GIRI_BASE });
        const pace = creaPasso({ delta70, rho: rhoEff, nGiri: gara.nGiri, basi });
        let somma = 0;
        let n = 0;
        for (const { drv, lap, cella } of righe) {
          if (lap <= Lf || !passoUtilizzabile(cella) || cella.tyre_age === null) continue;
          const previsto = pace(drv, lap, cella.tyre_age);
          if (previsto === null) continue; // base assente: fuori da ENTRAMBI i bracci (stesso insieme)
          somma += Math.abs(previsto - cella.lap_time);
          n += 1;
        }
        mae[braccio] = n > 0 ? somma / n : null;
        nBersagli = n;
      }
      if (nBersagli === null || nBersagli < MIN_GIRI_BERSAGLIO) continue;

      const delta = mae.live - mae.statico;
      delte.push(delta);
      dettaglio.push({
        gara: nome, Lf, n_bersagli: nBersagli,
        moltiplicatore: calibrazione.moltiplicatore,
        moltiplicatore_null: calibrazione.moltiplicatore === null,
        mae_statico: Number(mae.statico.toFixed(6)),
        mae_live: Number(mae.live.toFixed(6)),
        delta_mae: Number(delta.toFixed(6)),
      });
    }
    perCongelamento[Lf] = {
      n_gare: delte.length,
      giudicabile: delte.length >= MIN_GARE,
      mediana_delta_mae: delte.length ? Number(mediana(delte).toFixed(6)) : null,
      vinto_dal_live: delte.length >= MIN_GARE ? mediana(delte) < 0 : null,
    };
  }

  const giudicabili = Object.values(perCongelamento).filter((c) => c.giudicabile);
  const vinti = giudicabili.filter((c) => c.vinto_dal_live).length;
  return {
    per_congelamento: perCongelamento,
    congelamenti_giudicabili: giudicabili.length,
    vinti_dal_live: vinti,
    g5_passa: giudicabili.length >= 2 && vinti >= 2,
    dettaglio_per_gara: dettaglio,
  };
}

const eseguitoDirettamente = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (eseguitoDirettamente) {
  const radice = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const r = eseguiG5(radice, caricaGare2026(radice));
  const esito = {
    _targhetta: {
      tipo: 'esito del cancello causale G5, eseguito come pre-registrato',
      prereg: 'banco/prereg/PREREG_G5.md',
      eseguito_da: 'banco/replay_g5.mjs',
      percorso: 'feed d\'archivio → collettore live → calibratore (status per-auto)',
      data: '2026-07-29',
      conseguenza: 'se g5_passa è false, il moltiplicatore resta DIAGNOSTICA: non entra nei percorsi decisionali live',
    },
    ...r,
  };
  const dest = path.join(radice, 'banco', 'prereg', 'ESITO_G5.json');
  mkdirSync(path.dirname(dest), { recursive: true });
  writeFileSync(dest, JSON.stringify(esito, null, 2) + '\n');

  console.log('Lf   gare  giudicabile  mediana ΔMAE   vinto dal live');
  for (const [Lf, c] of Object.entries(r.per_congelamento)) {
    console.log(`${String(Lf).padEnd(4)} ${String(c.n_gare).padStart(3)}   ${String(c.giudicabile).padEnd(11)}  ${c.mediana_delta_mae === null ? '—' : (c.mediana_delta_mae >= 0 ? '+' : '') + c.mediana_delta_mae.toFixed(4)}       ${c.vinto_dal_live}`);
  }
  console.log(`\nG5 ${r.g5_passa ? 'PASSA' : 'NON PASSA'} (${r.vinti_dal_live}/${r.congelamenti_giudicabili} congelamenti giudicabili vinti dal live)`);
  console.log('esito scritto: banco/prereg/ESITO_G5.json');
}
